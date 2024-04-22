const express = require("express");
const soap = require("soap");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const redis = require("redis");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());


app.post("/get", (req, res) => {
    console.log(req.body)
    res.send("Hello World! 2");
});

app.post("/post", (req, res) => {
    res.send("Hello World!");
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
} );