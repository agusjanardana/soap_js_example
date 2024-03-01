// create simple API Express

const express = require("express");
const redis = require("redis");

const app = express();

app.get("/hello", (req, res) => {
  res.json({ message: "Hello World" });
});

app.post("/redis", async (req, res) => {
  console.log("Redis API");
  // get the body
  const body = req.body;

  // save to redis
  const client = redis.createClient();
  await client.connect();
  await client.set("session_log", body.session);

  // close redis
  await client.quit();

  return res.json({ message: "OK" });
});

app.listen(8000, () => console.log("Server ready"));
