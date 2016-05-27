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

var EddystoneYunziScanner = function() {
  this._discovered = {};

  noble.on('discover', this.onDiscover.bind(this));
};

util.inherits(EddystoneYunziScanner, events.EventEmitter);


EddystoneYunziScanner.prototype.startScanning = function(allowDuplicates) {
  debug('startScanning');

  var startScanningOnPowerOn = function() {
    if (noble.state === 'poweredOn') {
      noble.startScanning([SERVICE_UUID], allowDuplicates);
    } else {
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

  debug('stopScanning');
  noble.stopScanning();
};

EddystoneYunziScanner.prototype.onDiscover = function(peripheral) {
  debug('onDiscover: %s', peripheral);

  if (this.isBeacon(peripheral)) {
    var beacon = this.parseBeacon(peripheral);
    beacon.lastSeen = Date.now();

    var oldBeacon = this._discovered[peripheral.id];

    if (!oldBeacon) {
      this.emit('found', beacon);
    } else {
      var toCopy;

      if (beacon.type === 'tlm') {
        toCopy = ['type', 'url', 'namespace', 'instance'];
      } else {
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

  var serviceData = peripheral.advertisement.serviceData;

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
  var moving = data2.readUInt8(16); 
 
  if(moving == 0) {
	var temp1 = 0;}
  else{
	var temp1 = 1;}

  var beacon = {};
  var rssi = peripheral.rssi;
 	
  beacon.id = peripheral.id;
  beacon.rssi = rssi;
 
  var txPower = beacon.txPower;
  if (txPower !== undefined) {
    beacon.distance = this.calculateDistance(txPower, rssi);
  }
  if(data.length == 14 && frameType == TLM_FRAME_TYPE)
  {
	var temperature = (data.readUInt16BE(4)/256)-10;
  }

  return {
	frame:{     
	sensor_id: peripheral.id,
	sensor_motion: moving,
	sensor_light: light,
	sensor_temp: temperature,
	sensor_battery: battery,
	sensor_time: Date.now(),
//	sensor_power: rssi         // uncomment to return beacon's signal strengh indicator
	      }
	};
};


EddystoneYunziScanner.prototype.calculateDistance = function(txPower, rssi) {
  return Math.pow(10, ((txPower - rssi) - 41) / 20.0);
};

wss.on("connection", function(ws) {		
	var id = setInterval(function() {
		ws.send(JSON.stringify(beacon), function() {})
		},1000)
		console.log("websocket connection open")
	
wss.on("close", function() {
	console.log("websocket connection close")		
	clearInterval(id)
	})
})
	

module.exports = EddystoneYunziScanner;

server.listen(8080, function() {
	console.log('server up and running at 8080 port');
});
