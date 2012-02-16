
var NativeModule;

// Hack to get a reference to node's internal NativeModule
// Courtesy of Brandon Benvie, https://github.com/Benvie/Node.js-Ultra-REPL/blob/master/lib/ScopedModule.js
(function(){
  // intercept NativeModule.require's call to process.moduleLoadList.push
  process.moduleLoadList.push = function(){
    // `NativeModule.require('native_module')` returns NativeModule
    NativeModule = arguments.callee.caller('native_module');

    // delete the interceptor and forward normal functionality
    delete process.moduleLoadList.push;
    return Array.prototype.push.apply(process.moduleLoadList, arguments);
  }
  // force one module resolution
  require('url');
})();

// defines the subset of module functionality that will be exposed
// to the haiku-http handler via the "require" function

var moduleSandbox = {

	// subset fuctionality of these modules to only expose client side APIs
	// as needed, wrap APIs to sandbox inputs or outputs

	http : {
		request: wrapHttpRequest,
		get: wrapHttpRequest,
		Agent: true
	},

	https : {
		request: wrapHttpRequest,
		get: wrapHttpRequest		
	},

	tls : {
		createSecurePair: true,
		connect: true
	},

	net : {
		Stream: true,
		createConnection: true,
		connect: true
	},

	// secrity treat as safe APIs

	url : true,
	util : true,
	buffer : true,
	crypto : true,
	stream : true,
	events : true,

	// security transparent APIs

	mongodb : true,
	request : true,

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
		if (typeof object === 'function' && executionContext)
			// ensure the function is invoked in the correct execution context
			return function () { return object.apply(executionContext, arguments); }
		else 
			// "security treat as safe", return back without wrapping 
			return object;
	} 
	else {

		// Sandbox properties owned by object and properties inherited from the prototype chain
		// this flattens out the properties inherited from the prototype chain onto
		// a single result object. Any code that depends on the existence of the prototype chain
		// will likely be broken by this, but any code that just invokes the members should continue
		// working.

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
		//require: sandboxedRequire,
		require: require,
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
	var inRequireEpisode = false;
	module._load = function (request, parent, isMain) {

		// 'Require episode' is a synchronous module resolution code path initiated
		// with the topmost invocation of 'require' method on the call stack. 
		// A require episode may recursively invoke 'require' again.
		// The purpose of the machanism below is to limit module caching to a single 
		// 'require episode' to:
		// - support cyclic module dependencies within a single require episode,
		// - avoid sharing module instances across several haiku handlers.
		// This is achieved by removing all cached modules at the beginning of every
		// require episode. 

		// TODO: investigate ways of scoping module caching to a single haiku handler
		// (script context) for improved performance.

		// if (request === 'querystring')
		// 	console.log(new Error().stack)
		
		var enteredRequireEpisode = false;
		if (!inRequireEpisode) {
			inRequireEpisode = enteredRequireEpisode = true;
			for (var i in module._cache) 
				delete module._cache[i];
			for (var i in NativeModule._cache) 
				delete NativeModule._cache[i];
		}

		try {
			if (moduleSandbox[request])
				return createObjectSandbox(moduleSandbox[request], originalLoad(request, parent, isMain))
			else if (request[0] === '.' || request === 'querystring') // request module requires its own 'querystring' without a dot
				return originalLoad(request, parent, isMain);
			else
				throw 'Module ' + request + ' is not available in the haiku-http sandbox.'
		}
		finally {
			if (enteredRequireEpisode)
				inRequireEpisode = false;
		}
	}
}

exports.createSandbox = createSandbox;
exports.wrapFunction = wrapFunction;
exports.enterModuleSandbox = enterModuleSandbox;