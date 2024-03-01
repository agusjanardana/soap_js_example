var soap = require('soap');
var url = 'http://localhost:3030/wsdl/data?wsdl';
soap.createClient(url, function(err, client) {
  if(err != null) {
    console.log("client create error: ", err);
  }

  if(client != null) {
    //console.log(client.describe());
    // client.GetSessionId({ username: 'bagus', password: '123456'}, function(err, result) {
    //     console.log("result: ", result);
    // });
    var soapHeader = {
      "Location": "127.0.0.1",
    };
    client.addSoapHeader(soapHeader);

    client.GetData({}, function(err, result) {
        console.log("result: ", result);
        console.log(soapHeader);
    });
  }
});