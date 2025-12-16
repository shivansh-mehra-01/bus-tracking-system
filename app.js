// app.js
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const User = require("./models/user");
const http = require("http");
const socketIo = require("socket.io");

const server = http.createServer(app);
const io = socketIo(server);

require("dotenv").config();

// ===== MongoDB =====
mongoose
  .connect(process.env.MONGO_URL || "mongodb://localhost:27017/myapp")
  .then(() => console.log("Connected to MongoDB"))
  .catch(console.error);

// ===== Express setup =====
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/boilerplate");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);

// ===== Session =====
app.use(
  session({
    name: "sid",
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }
  })
);

app.use((req, res, next) => {
  res.locals.loggedIn = !!req.session?.userId;
  res.locals.username = req.session?.username || null;
  next();
});

// ===== Auth Guards =====
const isAuthenticated = (req, res, next) =>
  req.session?.userId ? next() : res.redirect("/auth/login");

const isStudent = (req, res, next) =>
  req.session.roll === "student" ? next() : res.sendStatus(403);

const isDriver = (req, res, next) =>
  req.session.roll === "driver" ? next() : res.sendStatus(403);

// ================= SOCKET.IO =================

// busNumber -> { busNumber, routeName, socketId, driverName }
const liveBuses = {};

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // ✅ MOST IMPORTANT LINE (student late join fix)
  socket.emit("liveBuses", Object.values(liveBuses));

  socket.on("driverLive", ({ busNumber, routeName, driverName }) => {
    if (!busNumber || !routeName) return;

    liveBuses[busNumber] = {
      busNumber,
      routeName,
      socketId: socket.id,
      driverName
    };

    console.log("Bus live:", busNumber);
    io.emit("liveBuses", Object.values(liveBuses));
  });

  socket.on("driverLocation", ({ latitude, longitude }) => {
    const bus = Object.values(liveBuses).find(
      (b) => b.socketId === socket.id
    );
    if (!bus) return;

    io.emit("busLocation", {
      busNumber: bus.busNumber,
      latitude,
      longitude
    });
  });

  socket.on("driverOffline", () => removeBus(socket.id));
  socket.on("disconnect", () => removeBus(socket.id));
});

function removeBus(socketId) {
  for (const busNo in liveBuses) {
    if (liveBuses[busNo].socketId === socketId) {
      console.log("Bus offline:", busNo);
      delete liveBuses[busNo];
      io.emit("liveBuses", Object.values(liveBuses));
      break;
    }
  }
}

// ================= ROUTES =================

app.get("/", (req, res) => {
  if (!req.session.userId) return res.redirect("/auth/login");
  return req.session.roll === "driver"
    ? res.redirect("/driver/dashboard")
    : res.redirect("/student/dashboard");
});

app.get("/auth/login", (req, res) =>
  res.render("auth/login", { layout: false })
);

app.get("/auth/register", (req, res) =>
  res.render("auth/register", { layout: false })
);

app.post("/auth/register", async (req, res) => {
  const { username, password, roll, busNumber, routeName } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    const userData = {
      username,
      password: hashed,
      roll
    };

    if (roll === "driver") {
      userData.busNumber = busNumber;
      userData.routeName = routeName;
    }

    const user = await User.create(userData);

    // session set ONLY after successful creation
    req.session.userId = user._id;
    req.session.roll = roll;

    return res.redirect(
      roll === "driver"
        ? "/driver/dashboard"
        : "/student/dashboard"
    );

  } catch (err) {
    if (err.code === 11000) {
      console.log("Username already exists");
      return res.send("Username already exists");
    }

    console.error(err);
    return res.status(500).send("Registration failed");
  }
});

app.post("/auth/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.send("Invalid credentials");
  }

  req.session.userId = user._id;
  req.session.roll = user.roll;

  res.redirect(user.roll === "driver" ? "/driver/dashboard" : "/student/dashboard");
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).send("Logout failed");
    }
    res.clearCookie("sid");
    res.redirect("/auth/login");
  });
});

app.get("/student/dashboard", isAuthenticated, isStudent, (req, res) =>
  res.render("panels/student-dashboard")
);

app.get("/driver/dashboard", isAuthenticated, isDriver, async (req, res) => {
  const driver = await User.findById(req.session.userId);
  res.render("panels/driver-dashboard", {
    driverName: driver.username,
    busNumber: driver.busNumber,
    routeName: driver.routeName
  });
});

server.listen(3000, () => console.log("Server running on 3000"));
