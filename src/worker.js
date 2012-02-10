var http = require('http')
	, https = require('https')
	, url = require('url')
	, vm = require('vm')
	, cluster = require('cluster')

var cooldown = false
	, activeRequests = 0
	, requestCount = 0
	, argv

process.on('message', function (msg) {
	process.send({ response: msg.challange });
})

function log(thing) {
	console.log(process.pid + ': ' + thing);
}

function onRequestFinished(context) {
	if (!context.finished) {
		context.finished = true;
		activeRequests--;
		if (cooldown && 0 === activeRequests) {
			process.nextTick(function() {
				log('Recycling self.')
				process.exit();
			});
		}
	}
}

function haikuError(context, status, error) {
	log(new Date() + ' Status: ' + status + ', Error: ' + error);
	try {
		context.req.resume();
		context.res.writeHead(status);
		if ('HEAD' !== context.req.method)
			context.res.end((typeof error === 'string' ? error : JSON.stringify(error)) + '\n');
		else
			context.res.end();
	}
	catch (e) {
		// empty
	}
	onRequestFinished(context);
}

function intercept(instance, func, inspector) {
	var oldFunc = instance[func];
	instance[func] = function () {
		var result = oldFunc.apply(instance, arguments);
		inspector(arguments, result);
		return result;
	}
}

function createSandbox(context) {

	// limit execution time of the handler to the preconfigured value

	context.timeout = setTimeout(function () {
		delete context.timeout;
		haikuError(context, 500, 'Handler ' + context.handlerName + ' did not complete within the time limit of ' + argv.t + 'ms');
		onRequestFinished(context);
	}, argv.t);

	// re-enable the server to accept subsequent connection when the response is sent

	intercept(context.res, 'end', function () {
		if (context.timeout) {
			clearTimeout(context.timeout);
			delete context.timeout;
			onRequestFinished(context);
		}
	});

	return {
		req: context.req,
		res: context.res,
		setTimeout: setTimeout,
		console: console
	};	
}

function executeHandler(context) {
	log(new Date() + ' executing ' + context.handlerName);

	context.req.resume();
	try {
		vm.runInNewContext(context.handler, createSandbox(context), context.handlerName);
	}
	catch (e) {
		haikuError(context, 500, 'Handler ' + context.handlerName + ' generated an exception at runtime: ' + e);
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
                    host: context.handlerUrl.host,
                    path: context.handlerUrl.path,
                    socket: socket, // using a tunnel
                    agent: false    // cannot use a default agent
                }, processResponse).on('error', processError);
        }).on('error', processError).end();
    }
    else // no proxy
        handlerRequest = engine.get({
	        host: context.handlerUrl.host,
	        path: context.handlerUrl.path
        }, processResponse).on('error', processError);
}

function processRequest(req, res) {
	activeRequests++;

	if (!cooldown && argv.r > 0 && ++requestCount >= argv.r) {
		log('Entering cooldown mode with active requests: ' + activeRequests);
		cooldown = true;
		httpServer.close();
		httpsServer.close();		
	}

	req.pause();
	resolveHandler({ 
		req: req, 
		res: res, 
		redirect: 0,
		handlerName: req.headers['x-haiku-handler'] || url.parse(req.url, true).query['x-haiku-handler']
	});
}

exports.main = function(args) {
	argv = args;
	httpServer = http.createServer(processRequest).listen(argv.p);
	httpsServer = https.createServer({ cert: argv.cert, key: argv.key }, processRequest).listen(argv.s);
}
