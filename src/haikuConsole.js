var sandbox = require('./sandbox.js')
	, url = require('url')
	, util = require('util')

function createDummyConsole() {
	var emptyFunction = function() {}
	return {
		log: emptyFunction,
		info: emptyFunction,
		warn: emptyFunction,
		error: emptyFunction,
		trace: emptyFunction,
		assert: emptyFunction,
		dir: emptyFunction,
		time: emptyFunction,
		timeEnd: emptyFunction
	}
}

function createBufferingConsole(context, maxSize) {
	context.consoleBuffer = '';

	var bufferedLog = function () {
		if (context.consoleBuffer !== undefined) { // this is undefined once console has been sent to the client
			context.consoleBuffer += util.format.apply(this, arguments) + '\n';
			if (context.consoleBuffer.length > maxSize)
				context.consoleBuffer = context.consoleBuffer.substring(context.buffer.length - maxSize);
		}
	}

	var emptyFunction = function() {}

	return {
		log: bufferedLog,
		info: bufferedLog,
		warn: bufferedLog,
		error: bufferedLog, 
		trace: emptyFunction,
		assert: emptyFunction,
		dir: emptyFunction,
		time: emptyFunction,
		timeEnd: emptyFunction
	};		
}

function encodeConsole(console) {
	return url.format({query : { c : console }}).substring(3).replace(/%20/g, ' ');
}

function createConsole(context, maxSize) {

	var result;

	var onWrite = function () {
		if (!context.onWriteProcessed) {
			context.onWriteProcessed = true;
			if ('header' === context.console) {
				context.res.setHeader('x-haiku-console', encodeConsole(context.consoleBuffer));
				delete context.consoleBuffer;
			}
			else if ('trailer' === context.console) 
				context.res.setHeader('Trailer', 'x-haiku-console');
		}

		if ('body' === context.console)
			return true; // ignore the application response
		else
			return arguments[--arguments.length].apply(this, arguments);
	}

	var onEnd = function () {
		if (!context.onEndProcessed) {
			context.onEndProcessed = true;
			var result;
			if ('trailer' === context.console) {
				context.res.addTrailers({'x-haiku-console': encodeConsole(context.consoleBuffer) });
				result = arguments[--arguments.length].apply(this, arguments);
			}
			else  // body
				result = arguments[--arguments.length].apply(this, [ context.consoleBuffer ]);

			delete context.consoleBuffer;

			return result;
		}
		else
			return arguments[--arguments.length].apply(this, arguments);
	}

	if ('header' === context.console) {
		result = createBufferingConsole(context, maxSize);
		context.res.writeHead = sandbox.wrapFunction(context.res, 'writeHead', onWrite);
		context.res.write = sandbox.wrapFunction(context.res, 'write', onWrite);
		context.res.end = sandbox.wrapFunction(context.res, 'end', onWrite);
	}
	else if ('trailer' === context.console) {
		result = createBufferingConsole(context, maxSize);	
		context.res.writeHead = sandbox.wrapFunction(context.res, 'writeHead', onWrite);
		context.res.write = sandbox.wrapFunction(context.res, 'write', onWrite);
		context.res.end = sandbox.wrapFunction(context.res, 'end', onEnd);
	}
	else if ('body' === context.console) {
		result = createBufferingConsole(context, maxSize);
		context.res.write = sandbox.wrapFunction(context.res, 'write', onWrite);
		context.res.end = sandbox.wrapFunction(context.res, 'end', onEnd);
	}
	else
		result = createDummyConsole();

	return result;
}

exports.createConsole = createConsole;