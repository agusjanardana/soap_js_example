const express = require("express");
const soap = require("soap");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require('bcryptjs');
require("dotenv").config();

const Aerospike = require("aerospike");
const op = Aerospike.operations;

const address = process.env.AEROSPIKE_URI;
const namespace = process.env.AEROSPIKE_NS;
const set = process.env.AEROSPIKE_SET;
const user_set = process.env.AEROSPIKE_USER_SET;

const LOCATION_FOR_HEADER = process.env.LOCATION_FOR_HEADER;

const caFile = process.env.AEROSPIKE_CA_FILE;
let isEnable = process.env.AEROSPIKE_TLS_ENABLE === "true" ? true : false;

const OS = require("os");
// const defaulThread = OS.cpus().length;

// process.env.UV_THREADPOOL_SIZE = defaulThread || process.env.UV_THREADPOOL_SIZE;

let aero_config = {
  hosts: address,
  log: {
    level: Aerospike.log.INFO,
  },
  user: process.env.AEROSPIKE_USER || "admin",
  password: process.env.AEROSPIKE_PASSWORD || "admin",
  tls: {
    enable: isEnable,
    cafile: caFile,
  },
};

let basePolicy = new Aerospike.BasePolicy({
  totalTimeout: 3000,
  socketTimeout: 3000,
});

const app = express();
app.use(
  bodyParser.raw({
    type: function () {
      return true;
    },
    limit: "5mb",
  })
);
app.use(cookieParser());

const users = [{ username: "bagus", password: "123456", sessionId: "ABC123" }];

function getSessionId(args) {
  console.log("args: ", args);
  const { username, password } = args;

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    data = {
      sessionId: user.sessionId,
      clientId: "Tel-Poin",
    };
    return data;
  } else {
    return null;
  }
}

// generate random session id
function generateSessionId() {
  return Math.random().toString(36).slice(2);
}

function hashPassword(password) {
  // Menggunakan SHA-256 untuk menghash password
  const hashedPassword = crypto
    .createHash("sha256")
    .update(password)
    .digest("hex");
  return hashedPassword;
}

async function checkPassword(inputPassword, hashedPassword) {
    try {
        // Membandingkan password yang dimasukkan dengan hash yang disimpan
        const match = await bcrypt.compare(inputPassword, hashedPassword);
        return match;
    } catch (error) {
        throw new Error('Error comparing passwords');
    }
}

let aerospikeClient;
Aerospike.connect(aero_config)
  .then((client) => {
    aerospikeClient = client;
    aerospikeClient.on("error", (err) =>
      console.log("Aerospike Client Error", err)
    );
    console.log("Connected to Aerospike");
  })
  .catch((error) => {
    console.error("Failed to connect to Aerospike:", error);
    process.exit(1); // Exit if connection fails
  });

const services = {
  AuthService: {
    AuthSoapPort: {
      GetSessionId: async function (args, cb, headers, req, res) {
        try {
          const sessionId = generateSessionId();
          const { OPNAME, PWD } = args;

          // let client = await Aerospike.connect(aero_config);

          let key = new Aerospike.Key(namespace, user_set, OPNAME);
          let dataUser = await aerospikeClient.get(key, basePolicy);

      
          const matchPassword = await checkPassword(PWD, dataUser.bins.password);
          // check password
          if (!matchPassword) {
            const data = {
              Result: {
                ResultCode: "1018",
                ResultDesc: "Password doesn't match",
              },
            };
            res.status(400);
            cb(null, data);
          }

          if (dataUser) {
            const data = {
              Result: {
                ResultCode: "0",
                ResultDesc: "Operation is successful",
              },
            };

            let key = new Aerospike.Key(namespace, set, sessionId);
            let bins = {
              session_id: sessionId, // isinya session key , misal session_id : akfzx123zs
              session_value: OPNAME, // isinya username, misal uplprov
            };

            var meta = {
              ttl: 50,
            };

            await aerospikeClient.put(key, bins, meta, basePolicy);

            res.setHeader("Session", sessionId);
            res.setHeader("Location", LOCATION_FOR_HEADER + sessionId);
            res.setHeader(
              "Location-maintenance",
              LOCATION_FOR_HEADER + sessionId
            );
            res.status(307);
            cb(null, data);
          } else {
            const data = {
              Result: {
                ResultCode: "1038",
                ResultDesc: "The record does not exist",
              },
            };
            res.setHeader("Location", LOCATION_FOR_HEADER);
            res.status(200);
            cb(null, data);
          }
        } catch (err) {
          // err code 2 jika tidak ditemukan data user
          if (err.code === 2) {
            const data = {
              Result: {
                ResultCode: "1038",
                ResultDesc: "The record does not exist",
              },
            };
            res.setHeader("Location", LOCATION_FOR_HEADER);
            res.status(307); // next ganti 440 -> 307 untuk semua sesison id invalid or time out
            cb(null, data);
          } else {
            const data = {
              Result: {
                ResultCode: "5001",
                ResultDesc: "Internal error",
              },
            };

            res.status(500);
            res.setHeader("Location", LOCATION_FOR_HEADER);
            cb(null, data);
          }
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

          // let client = await Aerospike.connect(aero_config);

          let key = new Aerospike.Key(namespace, set, sessionId);
          let value = await aerospikeClient.get(key, basePolicy);

          if (value) {
            // get username from sessionid
            let meta = {};
            await aerospikeClient.operate(
              key,
              [op.touch(50)],
              meta,
              basePolicy
            );

            const data = {
              Result: {
                ResultCode: "0",
                ResultDesc: "Operation is successful",
              },
            };
            res.setHeader("Location", LOCATION_FOR_HEADER + sessionId);
            res.setHeader(
              "Location-maintenance",
              LOCATION_FOR_HEADER + sessionId
            );

            return;
          } else {
            const data = {
              Result: {
                ResultCode: "5004",
                ResultDesc: "Session ID invalid or time out",
              },
            };
            res.setHeader("Location-maintenance", LOCATION_FOR_HEADER);
            res.status(307);
            return;
          }
        } catch (err) {
          // check if err containts Record does not exist
          if (err.code === 2) {
            const data = {
              Result: {
                ResultCode: "5004",
                ResultDesc: "Session ID invalid or time out",
              },
            };
            res.setHeader("Location-maintenance", LOCATION_FOR_HEADER);
            res.status(307);
            cb(null, data);
          } else {
            const data = {
              Result: {
                ResultCode: "5001",
                ResultDesc: "Internal error",
              },
            };

            res.status(500);
            res.setHeader("Location", LOCATION_FOR_HEADER);
            cb(null, data);
          }
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
                ResultCode: "1003",
                ResultDesc: "Invalid parameter name",
              },
            };
            res.status(400);
            cb(null, data);
          }

          // let client = await Aerospike.connect(aero_config);

          let key = new Aerospike.Key(namespace, set, sessionId);
          let value = await aerospikeClient.get(key, basePolicy);

          if (value) {
            await aerospikeClient.remove(key);

            const data = {
              Result: {
                ResultCode: "0",
                ResultDesc: "Operation is successful",
              },
            };

            res.status(307);
            res.setHeader("Location", LOCATION_FOR_HEADER);
            cb(null, data);
          } else {
            const data = {
              Result: {
                ResultCode: "5004",
                ResultDesc: "Session ID invalid or time out",
              },
            };

            res.status(307);
            res.setHeader("Location", LOCATION_FOR_HEADER);
            cb(null, data);
          }

          const data = {
            Result: {
              ResultCode: "1016",
              ResultDesc: "Operator not logged in",
            },
          };
          res.status(307);
          res.setHeader("Location", LOCATION_FOR_HEADER);

          cb(null, data);
        } catch (err) {
          if (err.code === 2) {
            const data = {
              Result: {
                ResultCode: "5004",
                ResultDesc: "Session ID invalid or time out",
              },
            };
            res.setHeader("Location", LOCATION_FOR_HEADER);
            res.status(307);
            cb(null, data);
          } else {
            const data = {
              Result: {
                ResultCode: "5001",
                ResultDesc: "Internal error",
              },
            };

            res.status(500);
            res.setHeader("Location", LOCATION_FOR_HEADER);
            cb(null, data);
          }
        }
      },
    },
  },
};

const authXml = fs.readFileSync("./services/auth-services.wsdl", "utf8");
const logoutXml = fs.readFileSync("./services/logout-services.wsdl", "utf8");
const maintenanceXml = fs.readFileSync(
  "./services/auth-maintenances.wsdl",
  "utf8"
);

const server = app.listen(8800, function () {
  const host = server.address().address;
  const port = server.address().port;
  console.log("Combined Service SOAP listening at http://%s:%s", host, port);

  soap.listen(app, "/LOGIN", services, authXml).on("response", (res) => {
    res.result = res.result.replace(/soap:Header/g, "SOAP-ENV:Header");
    res.result = res.result.replace(/soap:Envelope/g, "SOAP-ENV:Envelope");
    res.result = res.result.replace(/soap:Body/g, "SOAP-ENV:Body");
    res.result = res.result.replace(/soap:Fault/g, "SOAP-ENV:Fault");
    res.result = res.result.replace(/xmlns:soap/g, "xmlns:SOAP-ENV");
    res.result = res.result.replace(/ encoding="utf-8"/g, "");
    // res.result = res.result.replace(
    //   / xmlns="http:\/\/www\.huawei\.com\/"/g,
    //   ""
    // );
    res.result = res.result.replace(
      /  xmlns:tns="http:\/\/www\.huawei\.com\/USCDB\/LGI"/g,
      ""
    );
  });
  soap
    .listen(app, "/LOGOUT/:sessionId", services, logoutXml)
    .on("response", (res) => {
      res.result = res.result.replace(/soap:Header/g, "SOAP-ENV:Header");
      res.result = res.result.replace(/soap:Envelope/g, "SOAP-ENV:Envelope");
      res.result = res.result.replace(/soap:Body/g, "SOAP-ENV:Body");
      res.result = res.result.replace(/soap:Fault/g, "SOAP-ENV:Fault");
      res.result = res.result.replace(/xmlns:soap/g, "xmlns:SOAP-ENV");
      res.result = res.result.replace(/ encoding="utf-8"/g, "");

      // res.result = res.result.replace(
      //   / xmlns="http:\/\/www\.huawei\.com\/"/g,
      //   ""
      // );
      res.result = res.result.replace(
        /  xmlns:tns="http:\/\/www\.huawei\.com\/USCDB\/LGO"/g,
        ""
      );
    });
  soap
    .listen(app, "/MAINTENANCE/:sessionId", services, maintenanceXml)
    .on("response", (res) => {
      res.result = res.result.replace(/soap:Header/g, "SOAP-ENV:Header");
      res.result = res.result.replace(/soap:Envelope/g, "SOAP-ENV:Envelope");
      res.result = res.result.replace(/soap:Body/g, "SOAP-ENV:Body");
      res.result = res.result.replace(/soap:Fault/g, "SOAP-ENV:Fault");
      res.result = res.result.replace(/xmlns:soap/g, "xmlns:SOAP-ENV");
      res.result = res.result.replace(/ encoding="utf-8"/g, "");
      res.result = res.result.replace(
        / xmlns="http:\/\/www\.huawei\.com\/"/g,
        ""
      );
      res.result = res.result.replace(
        / xmlns="http:\/\/www\.huawei\.com\/"/g,
        ""
      );
      res.result = res.result.replace(
        /  xmlns:tns="http:\/\/www\.huawei\.com\/"/g,
        ""
      );
    });
});

process.on("SIGINT", () => {
  if (aerospikeClient) {
    aerospikeClient.on("end", () => {
      console.log("Aerospike connection closed");
      aerospikeClient.close();
    });
  } else {
    aerospikeClient.close();
  }
  process.exit();
});

module.exports = app;
