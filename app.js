const express = require('express');
const soap = require('soap');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');

const app = express();
app.use(bodyParser.raw({ type: function () { return true; }, limit: '5mb' }));
app.use(cookieParser());

const users = [
  { username: 'bagus', password: '123456', sessionId: 'ABC123' }
];

function checkSession(req, res, next) {
  const sessionId = req.cookies.sessionId;

  if (!sessionId) {
    return res.status(401).send('Unauthorized - Missing Session ID');
  }

  const user = users.find(u => u.sessionId === sessionId);

  if (!user) {
    return res.status(401).send('Unauthorized - Invalid Session ID');
  }

  next();
}

function getSessionId(args) {
  console.log("args: ", args)
    const { username, password } = args;

    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
      const responseXml = `<GetSessionIdResponse><sessionId>${user.sessionId}</sessionId></GetSessionIdResponse>`;
      return responseXml;
    } else {
      return null;
    }
}

function GetData () {
  const data = {
    name: 'John Doe',
    age: '30',
    city: 'Example City'
  };

  const responseXml = `<GetDataResponse><data><name>${data.name}</name><age>${data.age}</age><city>${data.city}</city></data></GetDataResponse>`;
  return data;
}

const services = {
  AuthService: { 
    AuthSoapPort: {
      GetSessionId: getSessionId
    }
  },

  DataService: {
    DataPort: {
      GetData: GetData
    }
  }
};


const authXml = fs.readFileSync('./services/auth-services.wsdl', 'utf8');
const dataXml = fs.readFileSync('./services/data-services.wsdl', 'utf8');
const weatherXml = fs.readFileSync('./services/weather-services.wsdl', 'utf8');

const server = app.listen(3030, function () {
  const host = server.address().address;
  const port = server.address().port;
  console.log('Combined Service SOAP listening at http://%s:%s', host, port);

  soap.listen(app, '/wsdl/login', services, authXml);
  soap.listen(app, '/wsdl/data', services, dataXml);
});


module.exports = app;
