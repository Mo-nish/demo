const express = require("express");
const app = express();

app.get("/home", (req, res) => {
  res.send("<h1>Testing</h1>");
});

const startServer = (port = 3000) => {
  return app.listen(port);
};

module.exports = { app, startServer };
