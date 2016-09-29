var events = require('events');
var util = require('util');
var http = require('http');
var server = http.createServer();
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({server: server})
var debug = require('debug')('eddystone-yunzi-scanner');
var noble = require('noble');
var urlDecode = require('eddystone-url-encoding').decode;
var SERVICE_UUID = 'feaa';
var SENSOR = '81e7';
var UID_FRAME_TYPE = 0x00;
var URL_FRAME_TYPE = 0x10;
var TLM_FRAME_TYPE = 0x20;
var EXIT_GRACE_PERIOD = 5000; // milliseconds
var port = 8080;

/* allow to get the RPI's address and stock it in the idRPI variable*/
var spawn = require('child_process').spawn;
var ls = spawn('cat', ['/proc/cpuinfo']);
var idRPI;
ls.stdout.on('data', function (data) {
  data.toString().split('\n').forEach(function (line) {
    var infosRPI = line.split('Serial');
    if(infosRPI[1] != null){
      var idRPI_split = infosRPI[1].split(': ');
      idRPI = idRPI_split[1];
    }
  });
});


var EddystoneYunziScanner = function() {
  this._discovered = {};
  noble.on('discover', this.onDiscover.bind(this));
};

util.inherits(EddystoneYunziScanner, events.EventEmitter);

EddystoneYunziScanner.prototype.startScanning = function(allowDuplicates) {
  var startScanningOnPowerOn = function() {
    if (noble.state === 'poweredOn') {
      noble.startScanning([SERVICE_UUID], allowDuplicates);
    } 
    else {
      noble.once('stateChange', startScanningOnPowerOn);
    }
  };

  startScanningOnPowerOn();

  this._allowDuplicates = allowDuplicates;
  if (allowDuplicates) {
    this._lostCheckInterval = setInterval(this.checkLost.bind(this), EXIT_GRACE_PERIOD / 2);
  }
};

EddystoneYunziScanner.prototype.stopScanning = function() {
  clearInterval(this._lostCheckInterval);
  noble.stopScanning();
};

EddystoneYunziScanner.prototype.onDiscover = function(peripheral) {
  if (this.isBeacon(peripheral)) {
    var beacon = this.parseBeacon(peripheral);
    beacon.lastSeen = Date.now();
    var oldBeacon = this._discovered[peripheral.id];

    if (!oldBeacon) {
      this.emit('found', beacon);
    } 
    else {
      var toCopy;

      if (beacon.type === 'tlm') {
        toCopy = ['type', 'url', 'namespace', 'instance'];
      } 
      else {
        toCopy = ['tlm'];
      }

      toCopy.forEach(function(property) {
        if (oldBeacon[property] !== undefined) {
          beacon[property] = oldBeacon[property];
        }
      });
    }

    this._discovered[peripheral.id] = beacon;
    this.emit('updated', beacon);
    this.websocket(beacon);
  }
};


EddystoneYunziScanner.prototype.checkLost = function() {
  for (var id in this._discovered) {
    var beacon = this._discovered[id];
    if (this._discovered[id].lastSeen < (Date.now() - EXIT_GRACE_PERIOD)) {
      this.emit('lost', beacon);
      delete this._discovered[id];
    }
  }
};

EddystoneYunziScanner.prototype.isBeacon = function(peripheral) {
  var serviceData = [null, null];
  serviceData = peripheral.advertisement.serviceData;

  // make sure the script will not crash at start : fill the serviceData[1].uuid
  if(serviceData.length == 1) {
          serviceData[1] = {uuid:"Waiting for the '81e7' frame"};
          console.log(serviceData[1].uuid)
  }
    // make sure service data is present, with the expected uuid and data length
  return ( serviceData &&
             serviceData.length > 0 &&
             serviceData[0].uuid === SERVICE_UUID &&
             serviceData[0].data.length > 2,
             serviceData.length > 0 &&
             serviceData[1].uuid === SENSOR &&
             serviceData[1].data.length > 2
  );
};


EddystoneYunziScanner.prototype.parseBeacon = function(peripheral) {
  var data = peripheral.advertisement.serviceData[0].data;
  var data2 = peripheral.advertisement.serviceData[1].data;

  var frameType = data.readUInt8(0);
  var accel_count = data2.readUInt8(16);
  var battery =data2.readUInt8(10);
  var light = 100*(data2.readUInt16BE(14)/25000);
  var moving = data2.readUInt8(18);
  var old_temperature;

  var temperature;

  var beacon = {};
  var rssi = peripheral.rssi;

  beacon.id = peripheral.id;
  beacon.rssi = rssi;

  var txPower = beacon.txPower;
  if (txPower !== undefined) {
    beacon.distance = this.calculateDistance(txPower, rssi);
  }
  
  if(data.length == 14 && frameType == TLM_FRAME_TYPE) {
    temperature = (data.readUInt16BE(4)/256)-10;
  }
 

  return {
    frame:{
      sensor_id: peripheral.id,
      sensor_motion: moving,
      sensor_light: light,
      sensor_temp: temperature,
      sensor_battery: battery,
      sensor_time: Date.now(),
      sensor_power: rssi,        
      raspberry_id : idRPI
    }
  };
};

EddystoneYunziScanner.prototype.calculateDistance = function(txPower, rssi) {
  return Math.pow(10, ((txPower - rssi) - 41) / 20.0);
};

/* allow to send the data via websocket on the variable "port" */
EddystoneYunziScanner.prototype.websocket = function(beacon){};

wss.on("connection", function(ws, beacon) {
  EddystoneYunziScanner.prototype.websocket = function(beacon)
  {
    ws.send(JSON.stringify(beacon), function() {})
  };
  console.log("websocket connection open")

  wss.on("close", function() {
    console.log("websocket connection close")
  })
})

module.exports = EddystoneYunziScanner;

server.listen(port, function() {
  console.log('server up and running at '+ port +' port');
});
