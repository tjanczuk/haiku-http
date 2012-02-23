var http = require('http')
	, https = require('https')
	, url = require('url')
	, vm = require('vm')
	, cluster = require('cluster')
	, util = require('util')
	, haikuConsole = require('./haikuConsole.js')
	, sandbox = require('./sandbox.js')

var shutdown
	, shutdownInProgress = false
	, requestCount = 0
	, argv

process.on('message', function (msg) {
	process.send({ response: msg.challange });
})
.on('uncaughtException', function (err) {
	log('Entering shutdown mode after an uncaught exception: ' 
		+ (err.message || err) + (err.stack ? '\n' + err.stack : ''));
	initiateShutdown();
});

function log(thing) {
	console.log(process.pid + ': ' + thing);
}

function shutdownNext() {
	if (shutdown) {
		clearTimeout(shutdown);
		shutdown = undefined;
	}

	process.nextTick(function() {
		log('Recycling self. Active connections: TCP: ' + httpServer.connections + ', TLS: ' + httpsServer.connections);
		process.exit();
	});	
}

// raised by HTTP or HTTPS server when one of the client connections closes
function onConnectionClose() {
	if (shutdownInProgress && 0 === (httpServer.connections + httpsServer.connections))
		shutdownNext()
}

function initiateShutdown() {
	if (!shutdownInProgress) {

		// stop accepting new requests

		httpServer.close();
		httpsServer.close();		

		shutdownInProgress = true;

		if (0 === (httpServer.connections + httpsServer.connections)) {
			// there are no active connections - shut down now

			shutdownNext();
		}
		else {
			// Shut down when all active connections close (see onConnectionClose above) 
			// or when the graceful shutdown timeout expires, whichever comes first.
			// Graceful shutdown timeout is twice the handler processing timeout.

			shutdown = setTimeout(shutdownNext, argv.t * 2); 
		}
	}
}

function onRequestFinished(context) {
	if (!context.finished) {
		context.finished = true;
		context.req.socket.end(); // force buffers to be be flushed
	}
}

function haikuError(context, status, error) {
	log(new Date() + ' Status: ' + status + ', Request URL: ' + context.req.url + ', Error: ' + error);
	try {
		context.req.resume();
		context.res.writeHead(status);
		if (error && 'HEAD' !== context.req.method)
			context.res.end((typeof error === 'string' ? error : JSON.stringify(error)) + '\n');
		else
			context.res.end();
	}
	catch (e) {
		// empty
	}
	onRequestFinished(context);
}

function limitExecutionTime(context) {

	// setup timeout for request processing

	context.timeout = setTimeout(function () {
		delete context.timeout;
		haikuError(context, 500, 'Handler ' + context.handlerName + ' did not complete within the time limit of ' + argv.t + 'ms');
		onRequestFinished(context);
	}, argv.t); // handler processing timeout
	
	// intercept end of response to cancel the timeout timer and 
	// speed up shutdown if one is in progress

	context.res.end = sandbox.wrapFunction(context.res, 'end', function () {
		var result = arguments[--arguments.length].apply(this, arguments);
		if (context.timeout) {
			clearTimeout(context.timeout);
			delete context.timeout;
			onRequestFinished(context);
		}
		return result;
	});	
}

function executeHandler(context) {
	log(new Date() + ' executing ' + context.handlerName);

	// limit execution time of the handler to the preconfigured value

	limitExecutionTime(context);

	// expose rigged console through sandbox 

	var sandboxAddons = {
		console: haikuConsole.createConsole(context, argv.l, argv.d)
	}

	// evaluate handler code in strict mode to prevent stack walking from untrusted code

	context.handler = "'use strict';" + context.handler;

	context.req.resume();
	try {
		vm.runInNewContext(context.handler, sandbox.createSandbox(context, sandboxAddons), context.handlerName);
	}
	catch (e) {
		haikuError(context, 500, 'Handler ' + context.handlerName + ' generated an exception at runtime: ' 
			+ (e.message || e) + (e.stack ? '\n' + e.stack : ''));
	}
}

function resolveHandler(context) {
	if (!context.handlerName)
		return haikuError(context, 400, 
			'The x-haiku-handler HTTP request header or query paramater must specify the URL of the scriptlet to run.');

	try {
		context.handlerUrl = url.parse(context.handlerName);
	}
	catch (e) {
		return haikuError(context, 400, 'The x-haiku-handler parameter must be a valid URL that resolves to a JavaScript scriptlet.');
	}

	var engine;
	if (context.handlerUrl.protocol === 'http:') {
		engine = http;
		context.handlerUrl.port = context.handlerUrl.port || 80;
	}
	else if (context.handlerUrl.protocol === 'https:') {
		engine = https;
		context.handlerUrl.port = context.handlerUrl.port || 443;
	}
	else
		return haikuError(context, 400, 'The x-haiku-handler parameter specifies unsupported protocol. Only http and https are supported.');
	
	var handlerRequest;
    var processResponse = function(res) {
        context.handler = '';
        var length = 0;
        res.on('data', function(chunk) {
        	length += chunk.length;
        	if (length > argv.i) {
        		handlerRequest.abort();
        		return haikuError(context, 400, 'The size of the handler exceeded the quota of ' + argv.i + ' bytes.');
        	}
            context.handler += chunk;
        })           
        .on('end', function() {
            if (res.statusCode === 200)
            	executeHandler(context);
            else if (res.statusCode === 302 && context.redirect < 3) {
            	context.handlerName = res.headers['location'];
            	context.redirect++;
            	resolveHandler(context);
            } 
            else 
                return haikuError(context, 400, 'HTTP error when obtaining handler code from ' + context.handlerName + ': ' + res.statusCode);
        }); 
    }

    var processError = function(error) {
        haikuError(context, 400, 'Unable to obtain HTTP handler code from ' + context.handlerName + ': ' + error);
    }

    if (argv.proxyHost) {
         // HTTPS or HTTP request through HTTP proxy
        http.request({ // establishing a tunnel
          host: argv.proxyHost,
          port: argv.proxyPort,
          method: 'CONNECT',
          path: context.handlerUrl.hostname + ':' + context.handlerUrl.port
        }).on('connect', function(pres, socket, head) {
            if (pres.statusCode !== 200) 
                return haikuError(context, 400, 'Unable to connect to the host ' + context.host);
            else 
                handlerRequest = engine.get({
                    host: context.handlerUrl.hostname,
                    port: context.handlerUrl.port,
                    path: context.handlerUrl.path,
                    socket: socket, // using a tunnel
                    agent: false    // cannot use a default agent
                }, processResponse).on('error', processError);
        }).on('error', processError).end();
    }
    else // no proxy 
        handlerRequest = engine.get({
	        host: context.handlerUrl.hostname,
	        port: context.handlerUrl.port,
	        path: context.handlerUrl.path
        }, processResponse).on('error', processError);
}

function getHaikuParam(context, name, defaultValue) {
	return context.req.headers[name] || context.reqUrl.query[name] || defaultValue;
}

function processRequest(req, res) {

	if (req.url === '/favicon.ico') 
		return haikuError({ req: req, res: res}, 404);

	if (!shutdownInProgress && argv.r > 0 && ++requestCount >= argv.r) {
		log('Entering shutdown mode after reaching request quota. Current active connections: TCP: ' 
			+ httpServer.connections + ', TLS: ' + httpsServer.connections);
		initiateShutdown();
	}

	req.pause();

	var context = {
		req: req,
		res: res,
		redirect: 0,
		reqUrl: url.parse(req.url, true)
	}
	context.handlerName = getHaikuParam(context, 'x-haiku-handler');
	context.console = getHaikuParam(context, 'x-haiku-console', 'none');

	resolveHandler(context);
}

exports.main = function(args) {
	argv = args;

	// enter module sanbox - from now on all module reustes in this process will 
	// be subject to sandboxing

	sandbox.enterModuleSandbox();

	httpServer = http.createServer(processRequest)
	.on('connection', function(socket) {
		socket.on('close', onConnectionClose)
	})
	.listen(argv.p);

	httpsServer = https.createServer({ cert: argv.cert, key: argv.key }, processRequest)
	.on('connection', function(socket) {
		socket.on('close', onConnectionClose)
	})
	.listen(argv.s);
}
