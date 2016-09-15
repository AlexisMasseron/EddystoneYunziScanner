##Scan for Yunzi beacons using Node.js

Uses noble for BLE peripheral scanning, then attempts to parse discovered peripherals using the Eddystone Protocol Specification. 

Based on sandeepmistry project : https://github.com/sandeepmistry/node-eddystone-beacon-scanner

Modified to scan and get all the sensors informations with a Sensoro Yunzi Beacon and store them in a JSON file.

The JSON is then send to a remote server using websocket.

## Usage

```javascript
var EddystoneYunziScanner = require('eddystone-yunzi-scanner');
```

##Launching: 
```sh
node scan.js
```
##Frame details:

  * ```sensor_id``` - Beacon's ID.
  * ```sensor_motion``` - Binary element so that 1 = moving / 0 = still.
  * ```sensor_light``` - Luminous flux in lux.
  * ```sensor_temp``` - Temperature in °C. The raw datas needs to be devided by 256 then subtracted by 10 to be correct.
  * ```sensor_rssi```- Beacon strength signal indicator in db.
  * ```sensor_battery``` - Beacon battery indicator in %.
  * ```sensor_time``` - Timestamp.

##Websocket connexion:
```javascript
wss.on("connection", function(ws, beacon) {
  // ...
  });
```  
Don't forget to select the right port:
```var port = 8080;```
