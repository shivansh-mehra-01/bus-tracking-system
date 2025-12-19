// ================= BASIC SETUP =================
require("dotenv").config();
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
const setUser = require("./middlewares/setUser");

// ================= SERVER + SOCKET =================
const server = http.createServer(app);
const io = socketIo(server);

// ================= MONGODB =================
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    console.log("DB Host:", mongoose.connection.host);
  })
  .catch(console.error);

// ================= EXPRESS CONFIG =================
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/boilerplate");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);

// ================= SESSION =================
app.use(
  session({
    name: "sid",
    secret: "mysecretkey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 }
  })
);

// locals middleware (navbar etc.)
app.use(setUser);

// ================= AUTH MIDDLEWARES =================
const isAuthenticated = (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect("/auth/login");
  }
  next();
};

const isStudent = (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect("/auth/login");
  }
  if (req.session.role !== "student") {
    return res.status(403).send("Forbidden: Students only");
  }
  next();
};

const isDriver = (req, res, next) => {
  if (!req.session?.userId) {
    return res.redirect("/auth/login");
  }
  if (req.session.role !== "driver") {
    return res.status(403).send("Forbidden: Drivers only");
  }
  next();
};

// ================= SOCKET.IO =================

// busNumber -> { busNumber, routeName, socketId, driverName }
const liveBuses = {};

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  // send existing live buses to new user
  socket.emit("liveBuses", Object.values(liveBuses));

  socket.on("driverLive", ({ busNumber, routeName, driverName }) => {
    if (!busNumber || !routeName) return;

    liveBuses[busNumber] = {
      busNumber,
      routeName,
      socketId: socket.id,
      driverName
    };

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

  socket.on("disconnect", () => {
    for (const busNo in liveBuses) {
      if (liveBuses[busNo].socketId === socket.id) {
        delete liveBuses[busNo];
        io.emit("liveBuses", Object.values(liveBuses));
        break;
      }
    }
  });
});

// ================= ROUTES =================

// root
app.get("/", (req, res) => {
  if (!req.session.userId) return res.redirect("/auth/login");

  return req.session.role === "driver"
    ? res.redirect("/driver/dashboard")
    : res.redirect("/student/dashboard");
});

// auth pages
app.get("/auth/login", (req, res) =>
  res.render("auth/login", { layout: false })
);

app.get("/auth/register", (req, res) =>
  res.render("auth/register", { layout: false })
);

// register
app.post("/auth/register", async (req, res) => {
  const { username, password, role, busNumber, routeName } = req.body;

  try {
    const hashed = await bcrypt.hash(password, 10);

    const userData = { username, password: hashed, role };

    if (role === "driver") {
      userData.busNumber = busNumber;
      userData.routeName = routeName;
    }

    const user = await User.create(userData);

    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.username = user.username;

    return res.redirect(
      user.role === "driver"
        ? "/driver/dashboard"
        : "/student/dashboard"
    );
  } catch (err) {
    if (err.code === 11000) {
      return res.send("Username already exists");
    }
    console.error(err);
    res.status(500).send("Registration failed");
  }
});

// login
app.post("/auth/login", async (req, res) => {
  const user = await User.findOne({ username: req.body.username });

  if (!user || !(await bcrypt.compare(req.body.password, user.password))) {
    return res.send("Invalid credentials");
  }

  req.session.userId = user._id;
  req.session.role = user.role;
  req.session.username = user.username;

  if (user.role === "driver") {
    req.session.busNumber = user.busNumber;
    req.session.routeName = user.routeName;
  }

  return res.redirect(
    user.role === "driver"
      ? "/driver/dashboard"
      : "/student/dashboard"
  );
});

// logout
app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("sid");
    res.redirect("/auth/login");
  });
});

// dashboards
app.get("/student/dashboard", isStudent, (req, res) =>
  res.render("panels/student-dashboard")
);

app.get("/driver/dashboard", isDriver, async (req, res) => {
  const driver = await User.findById(req.session.userId);
  res.render("panels/driver-dashboard", {
    driverName: driver.username,
    busNumber: driver.busNumber,
    routeName: driver.routeName
  });
});

// profile
app.get("/profile", isAuthenticated, async (req, res) => {
  const user = await User.findById(req.session.userId);
  res.render("profile/profile", { user });
});

// ================= START SERVER =================
server.listen(3000, () =>
  console.log("🚀 Server running on http://localhost:3000")
);
