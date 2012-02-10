var cluster = require('cluster');
var argv;

function log(thing) {
	console.log(process.pid + ' (master): ' + thing);
}

function challange(worker) {
	worker.challangeTimeout = setTimeout(function() {
		delete worker.challangeTimeout;
		worker.currentChallange = Math.random();
		worker.send({ challange: worker.currentChallange });
		worker.keepaliveTimeout = setTimeout(function () {
			log('Worker ' + worker.process.pid + ' did not respond to keepalive challange within ' + argv.a + 'ms. Killing the process.');
			process.kill(worker.process.pid);
		}, argv.a); // the keepalive response timeout
	}, argv.v); // the keepalive interval
}

function stopKeepalive(worker) {
	if (worker.keepaliveTimeout) {
		clearTimeout(worker.keepaliveTimeout);
		delete worker.keepaliveTimeout;
	}	

	if (worker.challangeTimeout) {
		clearTimeout(worker.challangeTimeout);
		delete worker.challangeTimeout;
	}
}

function createOneWorker() {
	var worker = cluster.fork();

	worker.on('message', function(msg) {
		stopKeepalive(worker);
		if (msg.response !== worker.currentChallange) {
			log('Worker ' + worker.process.pid + ' sent incorrect response to keepalive challange. Killing the process.');
			process.kill(worker.process.pid);			
		}
		else
			challange(worker);
	});

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
	log('Keepalive response timeout [ms]: ' + argv.a);
	log('Keepalive interval [ms]: ' + argv.v);

	for (var i = 0; i < argv.w; i++) 
		createOneWorker();

	cluster.on('death', function (worker) {
		log('Worker ' + worker.process.pid + ' exited, creating replacement worker.');
		stopKeepalive(worker);
		createOneWorker();
	});

	log('haiku-http started. Ctrl-C to terminate.');
}
