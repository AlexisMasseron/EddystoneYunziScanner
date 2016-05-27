var EddystoneYunziScanner = require('../'); // use require('eddystone-yunzi-scanner-), if installed from npm

EddystoneYunziScanner.on('found', function(beacon){
	console.log('Frame content:\n', JSON.stringify(beacon, null, 2));
});

EddystoneYunziScanner.on('updated', function(beacon) {
	console.log('Frame content:\n', JSON.stringify(beacon, null, 2));
});

EddystoneYunziScanner.on('lost', function(beacon) {
	console.log('Lost Yunzi beacon\n Last frame content:\n', JSON.stringify(beacon, null, 2));
});

EddystoneYunziScanner.startScanning(true); 


