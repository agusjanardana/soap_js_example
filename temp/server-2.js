// create api hello world

var express = require("express");

var app = express();
app.use(express.json());

app.get("/hello", function (req, res) {
  res.send("Hello World");
});

app.get("/logout", function (req, res) {
  res.clearCookie("sessionId");
  res.send("Logout Success");
});

app.get("/maintance", function (req, res) {
  res.status(200).send("Maintance");
});

app.listen(8020, function () {
  console.log("Example app listening on port 8020!");
});
