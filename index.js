var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var ModbusRTU = require("modbus-serial");

// firebase stuff 
/*
var admin = require('firebase-admin');


var serviceAccount = require('./SolarSensor-06d5c234b657.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://solar-sensor.firebaseio.com'
  });
var db = admin.firestore()
// Add a new document in collection "cities"
db.collection("datapoint").doc().set({
    batteryVoltage: "28",
    time: new Date(),
})
.then(function() {
    console.log("Firebase document successfully written!");
})
.catch(function(error) {
    console.error("Error writing document: ", error);
});
*/
  
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});
var connectionExists = false;

io.on('connect', function(socket){
    connectionExists = true;
    console.log('client connected');
    setTimeout( function() {
        solarStatus();
    }, 1000);

    socket.on('disconnect', function(){
        connectionExists = false;
        console.log('client disconnected');
    });
});
// create an empty modbus client 

var client = new ModbusRTU();
var i=0;
// open connection to a serial port 
client.connectRTUBuffered("/dev/tty.usbserial-DN008CH0", {baudRate: 9600, dataBits: 8, stopBits: 2, flowControl: false, parity: 'none'});
client.setID(1);

var details = [];

function solarStatus() {
// read the values of 3 registers starting at address 11 
// on device number 1.
//console.log('solarstatus');
if (connectionExists) {
    client.readHoldingRegisters(0x0010, 48)
    .then(function(data) {
        console.log(data);
        if (data) {
            details = { 
            arrayCurrent: float16_to_float(data.data[1]).toFixed(2),
            arrayVoltage: float16_to_float(data.data[3]).toFixed(2),
            batteryVoltage: float16_to_float(data.data[2]).toFixed(2),
            chargeCurrent: float16_to_float(data.data[0]).toFixed(2),          
            targetVoltage: float16_to_float(data.data[47]).toFixed(2),};
         //   console.log(data);
        //};
        io.sockets.emit('message', details );  
       
       /* db.collection("datapoint").doc().set({
            arrayCurrent: details.arrayCurrent,
            batteryVoltage: details.batteryVoltage,
            time: new Date(),
        })*/
        setTimeout(solarStatus, 1000);
        } else { console.log('no data'); }
    })
    .catch(function(error) {
        console.log('Error getting data from Modbus');
    })
}

}

http.listen(9000, function(){
    console.log('listening on *:9000');
});

// function to input a float16 and return a float
function float16_to_float(h) {
    var s = (h & 0x8000) >> 15;
    var e = (h & 0x7C00) >> 10;
    var f = h & 0x03FF;

    if(e == 0) {
        return (s?-1:1) * Math.pow(2,-14) * (f/Math.pow(2, 10));
    } else if (e == 0x1F) {
        return f?NaN:((s?-1:1)*Infinity);
    }

    return (s?-1:1) * Math.pow(2, e-15) * (1+(f/Math.pow(2, 10)));
}


