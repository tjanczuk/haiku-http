var cluster = require('cluster');
var argv;

function log(thing) {
	console.log(process.pid + ': ' + thing);
}

function challange(worker) {
	
}

function createOneWorker() {
	var worker = cluster.fork();
	challange(worker);
}

exports.main = function (args) {
	argv = args;
	log('haiku-http: a runtime for simple HTTP web APIs');
	log('Number of workers: ' + argv.w);
	log('HTTP port: ' + argv.p);
	log('HTTPS port: ' + argv.s);
	log('HTTP proxy: ' + (argv.proxyHost ? (argv.proxyHost + ':' + argv.proxyPort) : 'none'));
	log('Max handler size [bytes]: ' + argv.i);
	log('Max handler execution time [ms]: ' + argv.t);
	log('Max requests before recycle: ' + argv.r);

	for (var i = 0; i < argv.w; i++) 
		createOneWorker();

	cluster.on('death', function (worker) {
		log('Worker ' + worker.process.pid + ' exited, creating replacement');
		createOneWorker();
	});

	log('haiku-http started. Ctrl-C to terminate.');
}
