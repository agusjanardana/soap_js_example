// create simple express js


// import express js
const express = require('express');
const app = express();
const Redis = require('ioredis');
// const bodyParser = require('body-parser');
require("dotenv").config();
// body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

function initializeRedis() {
  const redis = new Redis.Cluster([
      {
        host: process.env.REDIS_HOST_1,
        port: process.env.REDIS_PORT_1,
      },
      {
        host: process.env.REDIS_HOST_2,
        port: process.env.REDIS_PORT_2,
      },
      {
        host: process.env.REDIS_HOST_3,
        port: process.env.REDIS_PORT_3,
      },
    ])

  return redis
}

// create simple route
app.post('/set', async (req, res) => {
    console.log(req.body)
    try{
        const client = initializeRedis()
        const { key, value } = req.body
        await client.set(key, value)
        client.quit()
        res.status(200).send('Success')
    } catch (error) {
        res.status(500).send(error.message)
    }
});

app.get('/get', async (req, res) => {
    try{
        const client = initializeRedis()
        const { key } = req.query
        const value = await client.get(key)
        res.status(200).send(value)
    } catch (error) {
        res.status(500).send(error.message)
    }
});

// run server


app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
    }
);

