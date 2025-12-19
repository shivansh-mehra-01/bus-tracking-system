module.exports = (req, res, next) => {
  res.locals.currentUser = null;

  if (req.session && req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      role: req.session.role,
      username: req.session.username,
    };

    if (req.session.role === "driver") {
      res.locals.currentUser.busNumber = req.session.busNumber;
      res.locals.currentUser.routeName = req.session.routeName;
    }
  }

  next();
};
