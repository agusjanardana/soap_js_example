const express = require('express');
const soap = require('soap');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const redis = require('redis');
const crypto = require('crypto');
const Redis = require('ioredis');
require('dotenv').config();

const Aerospike = require('aerospike');
const op = Aerospike.operations;

const address = process.env.AEROSPIKE_URI;
const namespace = process.env.AEROSPIKE_NS;
const set = process.env.AEROSPIKE_SET;
const user_set = process.env.AEROSPIKE_USER_SET;
const port = process.env.PORT;

let aero_config = {
  hosts: address,
  log: {
    level: Aerospike.log.INFO,
  },
};

let basePolicy = new Aerospike.BasePolicy({
  totalTimeout: 20000,
  socketTimeout: 20000,
});

const app = express();
app.use(
  bodyParser.raw({
    type: function () {
      return true;
    },
    limit: '5mb',
  })
);
app.use(cookieParser());

const users = [{ username: 'bagus', password: '123456', sessionId: 'ABC123' }];

function initializeRedis() {
  const redis = new Redis.Cluster([
    { host: process.env.REDIS_HOST_1, port: process.env.REDIS_PORT_1 },
    { host: process.env.REDIS_HOST_2, port: process.env.REDIS_PORT_2 },
    { host: process.env.REDIS_HOST_3, port: process / env.REDIS_PORT_4 },
    // Tambahkan node Redis Cluster lainnya di sini
  ]);

  return redis;
}

function getSessionId(args) {
  console.log('args: ', args);
  const { username, password } = args;

  const user = users.find((u) => u.username === username && u.password === password);

  if (user) {
    data = {
      sessionId: user.sessionId,
      clientId: 'Tel-Poin',
    };
    return data;
  } else {
    return null;
  }
}

function GetData(args, headers) {
  const data = {
    name: 'John Doe',
    age: '30',
    city: 'Example City',
  };

  // get the soap header from data
  console.log('headers: ', headers);
  console.log('args: ', args);
  // Lakukan sesuatu dengan header SOAP
  return data;
}

// generate random session id
function generateSessionId() {
  return Math.random().toString(36).slice(2);
}

function hashPassword(password) {
  // Menggunakan SHA-256 untuk menghash password
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
  return hashedPassword;
}

const url = `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`;

const services = {
  AuthService: {
    AuthSoapPort: {
      GetSessionId: async function (args, cb, headers, req, res) {
        try {
          const sessionId = generateSessionId();
          const { OPNAME, PWD } = args;

          // const client = redis.createClient({
          //   url: url,
          // });

          let client = await Aerospike.connect(aero_config);
          client.on('error', (err) => console.log('Aerospike Client Error', err));
          // await client.connect();
          // const value = await client.get('user');
          let key = new Aerospike.Key(namespace, user_set, OPNAME);
          let value = await client.get(key, basePolicy);

          if (value) {
            // Cek apakah ada user dengan username yang sesuai
            // var userData = JSON.parse(value);
            // var user = userData.find((u) => u.username === OPNAME);
            let user = true;

            if (user) {
              // const sessionVal = await client.get(OPNAME);
              // if (sessionVal) {
              //   const data = {
              //     Result: {
              //       ResultCode: "0",
              //       ResultDesc: "Operation is successful",
              //     }
              //   };
              //   await client.expire(OPNAME, 6000);
              //   await client.expire(sessionVal, 6000);
              //   client.quit();
              //   res.setHeader("Session", sessionVal);
              //   res.setHeader("Location", 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/USCDB/' + sessionVal)
              //   res.setHeader("Location-maintenance", 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/MAINTENANCE/' + sessionVal)
              //   res.status(307);
              //   cb(null, data);
              // }

              const data = {
                Result: {
                  ResultCode: '0',
                  ResultDesc: 'Operation is successful',
                },
              };

              // await client.set(OPNAME, sessionId);
              // await client.expire(OPNAME, 50);

              let key = new Aerospike.Key(namespace, set, sessionId);
              let bins = {
                session_id: sessionId, // isinya session key , misal session_id : akfzx123zs
                session_value: OPNAME, // isinya username, misal uplprov
              };

              var meta = {
                ttl: 50,
              };

              await client.put(key, bins, meta, basePolicy);
              client.close();
              // await client.set(sessionId, OPNAME);
              // await client.expire(sessionId, 50);

              // client.quit();
              res.setHeader('Session', sessionId);
              res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/' + sessionId);
              res.setHeader('Location-maintenance', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/' + sessionId);
              res.status(307);
              cb(null, data);
            } else {
              const data = {
                Result: {
                  ResultCode: '1038',
                  ResultDesc: 'The record does not exist',
                },
              };
              client.quit();
              // set http to 400
              res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');
              res.status(200);
              cb(null, data);
            }
          } else {
            const data = {
              Result: {
                ResultCode: '1038',
                ResultDesc: 'The record does not exist',
              },
            };
            client.quit();
            res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');
            res.status(200);
            cb(null, data);
          }
        } catch (err) {
          res.status(500);

          const data = {
            Result: {
              ResultCode: '5001',
              ResultDesc: 'Internal error',
            },
          };

          cb(null, data);
        }
      },
    },
  },

  MaintenanceService: {
    MaintenanceSoapPort: {
      MaintenanceSessionId: async function (args, cb, headers, req, res) {
        try {
          // get session id from params
          const sessionId = req.params.sessionId;
          // Cari user dengan sessionId yang sesuai di redis

          const client = redis.createClient({
            url: url,
          });
          client.on('error', (err) => console.log('Redis Client Error', err));

          await client.connect();

          const value = await client.get(sessionId);
          if (value) {
            // get username from sessionid
            await client.expire(sessionId, 50);
            // await client.expire(value, 50);

            const data = {
              Result: {
                ResultCode: '0',
                ResultDesc: 'Operation is successful',
              },
            };
            res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/' + sessionId);
            res.setHeader('Location-maintenance', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/' + sessionId);
            await client.quit();
            return;
          } else {
            const data = {
              Result: {
                ResultCode: '5004',
                ResultDesc: 'Session ID invalid or time out',
              },
            };
            res.setHeader('Location-maintenance', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');
            res.status(440);
            await client.quit();
            return;
          }
        } catch (err) {
          const data = {
            Result: {
              ResultCode: '5001',
              ResultDesc: 'Internal error',
            },
          };

          res.status(500);
          res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id');
          cb(null, data);
        }
      },
    },
  },

  DataService: {
    DataPort: {
      GetData: function (args, cb, headers, req, res) {
        // get headers
        try {
          const data = {
            name: 'John Doe',
            age: '30',
            city: 'Example City',
          };

          cb(null, data);
        } catch (err) {
          const data = {
            Result: {
              ResultCode: '5001',
              ResultDesc: 'Internal error',
            },
          };
          res.status(500);
          cb(null, data);
        }
      },
    },
  },

  LogoutService: {
    LogoutPort: {
      Logout: async function (args, cb, headers, req, res) {
        try {
          const sessionId = req.params.sessionId;

          if (!sessionId) {
            const data = {
              Result: {
                ResultCode: '1003',
                ResultDesc: 'Invalid parameter name',
              },
            };
            res.status(400);
            cb(null, data);
          }

          let client = await Aerospike.connect(aero_config);
          client.on('error', (err) => console.log('Aerospike Client Error', err));

          // await client.connect();

          // const value = await client.get(sessionId);
          let key = new Aerospike.Key(namespace, set, sessionId);
          let value = await client.get(key, basePolicy);

          if (value) {
            await client.remove(key);
            // await client.del(value);
            const data = {
              Result: {
                ResultCode: '0',
                ResultDesc: 'Operation is successful',
              },
            };

            await client.quit();
            res.status(307);
            res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');
            cb(null, data);
          } else {
            const data = {
              Result: {
                ResultCode: '5004',
                ResultDesc: 'Session ID invalid or time out',
              },
            };

            await client.quit();
            res.status(307);
            res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');
            cb(null, data);
          }

          const data = {
            Result: {
              ResultCode: '1016',
              ResultDesc: 'Operator not logged in',
            },
          };
          await client.quit();
          res.status(307);
          res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');

          cb(null, data);
        } catch (err) {
          const data = {
            Result: {
              ResultCode: '5001',
              ResultDesc: 'Internal error',
            },
          };
          res.setHeader('Location', 'https://cicdbsdsapigw.vdsp.telkomsel.co.id/');
          res.status(500);
          cb(null, data);
        }
      },
    },
  },
};

const authXml = fs.readFileSync('./services/auth-services.wsdl', 'utf8');
const dataXml = fs.readFileSync('./services/data-services.wsdl', 'utf8');
const logoutXml = fs.readFileSync('./services/logout-services.wsdl', 'utf8');
const maintenanceXml = fs.readFileSync('./services/auth-maintenances.wsdl', 'utf8');

const server = app.listen(8800, function () {
  const host = server.address().address;
  const port = server.address().port;
  console.log('Combined Service SOAP listening at http://%s:%s', host, port);

  soap.listen(app, '/LOGIN', services, authXml);
  soap.listen(app, '/DATA', services, dataXml);
  soap.listen(app, '/USCDB/TEST/:sessionId', services, dataXml);
  soap.listen(app, '/LOGOUT/:sessionId', services, logoutXml);
  soap.listen(app, '/MAINTENANCE/:sessionId', services, maintenanceXml);
});

module.exports = app;
