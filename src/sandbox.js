// defines the subset of module functionality that will be exposed
// to the haiku-http handler via the "require" function

var moduleSandbox = {

	// subset fuctionality of these modules to only expose client side APIs
	// as needed, wrap APIs to sandbox inputs or outputs

	http : {
		request: wrapHttpRequest,
		get: wrapHttpRequest,
		Agent: verbatim
	},
	https : {
		request: wrapHttpRequest,
		get: wrapHttpRequest		
	},

	tls : {
		createSecurePair: verbatim,
		connect: verbatim
	},

	net : {
		Stream: verbatim,
		createConnection: verbatim,
		connect: verbatim
	},

	// secrity treat as safe APIs

	url : true,
	util : true,
	buffer : true,
	crypto : true,
	stream : verbatim,
	events : true,

	// security transparent APIs

	mongodb : true,
	request : verbatim,

	// unsafe APIs that must be stubbed out

	fs : {
		// MongoDB library requires this module for GridStore scenarios, 
		// but they are not relevant for haiku-http, so the fs module instance never gets used	
	} 
}

// defines properties from http.ClientRequest (own and inherited) that will be
// exposed to the haiku-http handler

var clientRequestSandbox = {
	writable: true,
	write: true,
	end: true,
	abort: true,
	setTimeout: true,
	setNoDelay: true,
	setSocketKeepAlive: true,
	pipe: true,
	addListener: wrapResponseEvent,
	on: wrapResponseEvent,
	once: wrapResponseEvent,
	removeListener: true,
	removeAllListeners: true,
	setMaxListeners: true,
	listeners: true,
	emit: true	
}

// defines properties from http.ClientResponse (own and inherited) that will be
// exposed to the haiku-http handler

var clientResposeSandbox = {
	readable: true,
	statusCode: true,
	httpVersion: true,
	headers: true,
	trailers: true,
	setEncoding: true,
	pause: true,
	resume: true,
	pipe: true,
	addListener: true,
	on: true,
	once: true,
	removeListener: true,
	removeAllListeners: true,
	setMaxListeners: true,
	listeners: true,
	emit: true
}

// defines properties from http.ServerRequest (own and inherited) that will be
// exposed to the haiku-http handler

var serverRequestSandbox = { 
	readable: true,
	method: true,
	url: true,
	headers: true,
	trailers: true,
	httpVersion: true,
	setEncoding: true,
	pause: true,
	resume: true,
	pipe: true,
	addListener: true,
	on: true,
	once: true,
	removeListener: true,
	removeAllListeners: true,
	setMaxListeners: true,
	listeners: true,
	emit: true
}

// defines properties from http.ServerResponse (own and inherited) that will be
// exposed to the haiku-http handler

var serverResponseSandbox = { 
	writable: true,
	writeHead: true,
	statusCode: true,
	removeHeader: true,
	write: true,
	addTrailers: true,
	end: true,
	addListener: true,
	on: true,
	once: true,
	removeListener: true,
	removeAllListeners: true,
	setMaxListeners: true,
	listeners: true,
	emit: true
}

// wrap a function on an object with another function
// the wrapped function will be passed as the last argument to the wrapping function
// wrapping function is called in the context of the instance the wrapped function belongs to

function wrapFunction(instance, func, wrapperFunc) {
	var oldFunc = instance[func];
	return function () {
		arguments[arguments.length++] = oldFunc;
		return wrapperFunc.apply(instance, arguments);
	}
}

// exposes an object as-is without any wrapping

function verbatim(object, parent, nameOnParent, executionContext) {
	return object;
}

// wrap http.{request|get} to return a sandboxed http.ClientRequest

function wrapHttpRequest(object, parent, nameOnParent, executionContext) {
	return wrapFunction(parent, nameOnParent, function () {
		var clientRequest = arguments[--arguments.length].apply(this, arguments);
		return createObjectSandbox(clientRequestSandbox, clientRequest);
	});
}

// wrap http.ClientRequest.{on|once|addListener}('response', ...) to return a sandboxed http.ClientResponse

function wrapResponseEvent(object, parent, nameOnParent, executionContext) {
	return wrapFunction(parent, nameOnParent, function (type, listener) {
		var oldFunc = arguments[--arguments.length];
		if ('response' === type) {
			// intercept 'response' event subscription and sandbox the response
			// TODO this wrapping will make removeListener break
			oldFunc('request', function(res) {
				listener(createObjectSandbox(clientResposeSandbox, res));
			})
		}
		else
			// pass-through for all other event types
			return oldFunc.apply(this, arguments);
	});
}

function createObjectSandbox(sandbox, object, parent, nameOnParent, executionContext) {
	if (typeof sandbox === 'function') {
		// custom sandboxing logic
		return sandbox(object, parent, nameOnParent, executionContext);
	}
	else if (true === sandbox) {
		if (typeof object === 'function')
			// wrap functions to avoid global state
			return function () { return object.apply(executionContext, arguments); }
		else 
			// "security treat as safe", return back without wrapping 
			return object;
	} 
	else {

		// sandbox properties owned by object and properties inherited from the prototype chain
		// this flattens out the properties inherited from the prototype chain onto
		// a single result object; any code that depends on the existence of the prototype chain
		// will likely be broken by this, but any code that just invokes the members will continue
		// working

		var result = {};
		var current = object;
		while (current) {
			for (var element in sandbox) 
				if (!result[element] && current[element]) // preserve inheritance chain
					result[element] = createObjectSandbox(sandbox[element], current[element], current, element, object);
			current = Object.getPrototypeOf(current);
		}

		return result;
	}
}

// sandbox the 'require' method: if a module is on a whitelist, create a sanboxed instance
// otherwise throw

function sandboxedRequire(name) {
	if (moduleSandbox[name])
		return createObjectSandbox(moduleSandbox[name], require.apply(this, arguments));
	else
		throw 'Module ' + name + ' is not available in the haiku-http sandbox.'
}

function createSandbox(context, addons) {

	// expose sandboxed 'require', request, and response

	context.sandbox = {
		require: sandboxedRequire,
		//require: require,
		setTimeout: setTimeout,
		req: createObjectSandbox(serverRequestSandbox, context.req),
		res: createObjectSandbox(serverResponseSandbox, context.res)
	};

	// add custom add-ons to the sandbox (e.g. 'console')

	if (addons)
		for (var i in addons)
			context.sandbox[i] = addons[i];

	return context.sandbox;
}

function enterModuleSandbox() {
	var module = require('module');
	var originalLoad = module._load;
	module._load = function (request, parent, isMain) {
		if (moduleSandbox[request])
			return createObjectSandbox(moduleSandbox[request], originalLoad(request, parent, isMain))
		else if (request[0] === '.')
			return originalLoad(request, parent, isMain);
		else
			throw 'Module ' + request + ' is not available in the haiku-http sandbox.'
	}
}

exports.createSandbox = createSandbox;
exports.wrapFunction = wrapFunction;
exports.enterModuleSandbox = enterModuleSandbox;