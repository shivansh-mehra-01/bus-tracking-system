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

// --- MongoDB connect ---
mongoose
  .connect("mongodb://localhost:27017/myapp")
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Failed to connect to MongoDB", err));

// --- Express / EJS setup ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("layout", "layouts/boilerplate");

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(expressLayouts);

// --- Session middleware ---
app.use(
  session({
    name: "sid", // cookie name
    secret: "mysecretkey", // move to env in prod
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60, // 1 hour
      httpOnly: true,
    },
  })
);

// --- Make session info available in all templates ---
app.use((req, res, next) => {
  res.locals.loggedIn = !!req.session?.userId;
  res.locals.username = req.session?.username || null;
  next();
});

// --- Auth guard middleware ---
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) return next();
  return res.redirect("/auth/login");
};

const isStudent = (req, res, next) => {
  if (!req.session || req.session.roll !== "student") {
    return res.status(403).send("You must be a student to access this page.");
  }
  return next();
};

const isDriver = (req, res, next) => {
  if (!req.session || req.session.roll !== "driver") {
    return res.status(403).send("You must be a driver to access this page.");
  }
  return next();
};

// ----------------- SOCKET.IO -----------------
/*
  UPDATED:
  - Consolidated socket handlers here.
  - Server listens for:
      - "locationUpdate"  (generic client location -> server broadcasts "recieve-location")
      - "driverLocation"  (driver-specific -> server broadcasts "updateLocation")
      - "driverLive", "driverOffline"
  - Server emits:
      - "recieve-location", "updateLocation", "liveDrivers", "user-disconnected"
*/
const liveDrivers = {}; // socketId -> { name, socketId }

io.on('connection', (socket) => {
  console.log("Socket connected:", socket.id);

  // Generic client location (if used)
  socket.on("locationUpdate", (data) => {
    console.log('server got locationUpdate from', socket.id, data);
    io.emit("recieve-location", { id: socket.id, ...data });
  });

  // Driver marks themselves live (optional name)
  socket.on("driverLive", (data) => {
    const name = (data && data.name) ? data.name : `Driver-${socket.id.slice(0,6)}`;
    liveDrivers[socket.id] = { name, socketId: socket.id };
    // UPDATED: broadcast current live drivers
    io.emit("liveDrivers", Object.values(liveDrivers));
  });

  // Driver sends periodic location updates
  socket.on("driverLocation", (data) => {
    if (!data) return;
    const driverData = {
      id: socket.id,
      latitude: data.latitude,
      longitude: data.longitude,
      timestamp: Date.now()
    };
    // UPDATED: broadcast driver update
    io.emit("updateLocation", driverData);
  });

  // Driver goes offline voluntarily
  socket.on("driverOffline", () => {
    if (liveDrivers[socket.id]) {
      delete liveDrivers[socket.id];
      io.emit("liveDrivers", Object.values(liveDrivers));
    }
    io.emit("user-disconnected", { id: socket.id });
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    if (liveDrivers[socket.id]) {
      console.log("Driver disconnected:", socket.id, liveDrivers[socket.id].name);
      delete liveDrivers[socket.id];
      io.emit("liveDrivers", Object.values(liveDrivers));
    } else {
      console.log("Socket disconnected:", socket.id);
    }
    io.emit("user-disconnected", { id: socket.id });
  });
});

// ----- Routes ----- (unchanged except bugfix below)

// Home
app.get("/", (req, res) => {
  if (req.session?.userId) {
     if (req.session.roll === "student") { return res.redirect("/student/dashboard"); }
     if (req.session.roll === "driver") { return res.redirect("/driver/dashboard"); }
     return res.redirect("/auth/login");
  }
  res.render("home", { layout: "layouts/boilerplate" });
});

// Register page
app.get("/auth/register", (req, res) => {
  res.render("auth/register", { layout: false });
});

// Handle register
app.post("/auth/register", async (req, res) => {
  try {
    const { username, password, roll } = req.body;
    if (!username || !password || !roll) return res.status(400).send("Missing fields");

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(400).send("Username already taken. Go back and choose another.");
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = new User({ username, password: hashed, roll });
    console.log("Registering new user:", newUser);
    await newUser.save();

    // UPDATED: set session and redirect to appropriate dashboard
    req.session.userId = newUser._id;
    req.session.username = newUser.username;
    req.session.roll = newUser.roll;
    if (newUser.roll === "driver") {
      return res.redirect("/driver/dashboard");
    }
    if (newUser.roll === "student") {
      return res.redirect("/student/dashboard");
    }
    return res.redirect("/auth/login");
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(500).send("Registration failed");
  }
});

// Login
app.get("/auth/login", (req, res) => {
  if (req.session?.userId) return res.redirect("/student/dashboard");
  res.render("auth/login", { layout: false });
});

// Handle login
app.post("/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).send("Missing fields");

    const foundUser = await User.findOne({ username });
    if (!foundUser) return res.status(401).send("Invalid credentials");

    const isMatch = await bcrypt.compare(password, foundUser.password);
    if (!isMatch) return res.status(401).send("Invalid credentials");

    req.session.userId = foundUser._id;
    req.session.username = foundUser.username;
    req.session.roll = foundUser.roll;

    if (foundUser.roll === "driver") {
      return res.redirect("/driver/dashboard");
    }
    return res.redirect("/student/dashboard");
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).send("Login failed");
  }
});

// Dashboards
app.get("/student/dashboard", isAuthenticated, isStudent, (req, res) => {
  res.render("panels/student-dashboard");
});
app.get("/driver/dashboard", isAuthenticated, isDriver, (req, res) => {
  res.render("panels/driver-dashboard");
});

// Logout
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

// start
server.listen(3000, () => {
  console.log(`Server is running on http://localhost:3000`);
});
