var OriginalEventEmitter = require('events').EventEmitter
	, haiku_extensions = require('./build/Release/haiku_extensions.node')
	, module = require('module')
	, vm = require('vm')

// create EventEmitter interceptor that wraps original EventEmitter to
// intercept callbacks into user code and trigger the CPU watchdog
// and per user CPU consumption measurements in the haiku-http runtime

// TODO: event emitter should be compiled anew in the user V8 context rather than
// constructed by inheriting from the one created in main context to avoid shring global state. 
// See #11.

function EventEmitter() {

	var self = this

	OriginalEventEmitter.call(self)

	// 'emit' property cannot be deleted because it is non-writable by default
	// so user code cannot avoid entering the sandbox

	Object.defineProperty(this, 'emit', {
		enumerable: true,
		value: function(type) {
			var handlers = self.listeners(type)
			var userCode = handlers[0]
			if (typeof userCode === 'function') {
				userCode = userCode.listener || userCode
				if (typeof userCode === 'function') {
					haiku_extensions.enterUserCode(userCode)
				}
			}
			try {
				return OriginalEventEmitter.prototype.emit.apply(self, arguments)
			}
			finally {
				if (typeof userCode === 'function')
					haiku_extensions.leaveUserCode()
			}
		}
	})

}

require('util').inherits(EventEmitter, OriginalEventEmitter)

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

	// limit crypto surface area to support implementation closure of other modules

	crypto : {
		createHash: true		// required by MongoDB
	}, 

	// intercept entry points from node.js event loop into user JavaScript code that use EventEmitter

	events: {
		EventEmitter: function () { return EventEmitter; }
	},

	// secrity treat as safe APIs

	url : true,
	util : true,
	buffer : true,
	stream : true,

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
	// listeners: true,
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
	// listeners: true,
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
	// listeners: true,
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
	// listeners: true,
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
// haiku_extensions.printf('in createObjectSandbox ' + sandbox + ' ' + object)
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

function passthroughFunctionWrap(func) {
	return function () { return func.apply(func, arguments); }
}

function userFunctionWrap(func) {
	return function () {
		if (typeof func === 'function')
			haiku_extensions.enterUserCode(func)
		try {
			return func.apply(this, arguments)
		}
		finally {
			if (typeof func === 'function')
				haiku_extensions.leaveUserCode()			
		}
	}
}

function createSandbox(context, addons) {

	// expose sandboxed 'require', request, and response, plus some useful globals

	context.sandbox = {
		require: passthroughFunctionWrap(require), // sandboxing of module system happens in enterModuleSandbox() below
		setTimeout: passthroughFunctionWrap(setTimeout),
		clearTimeout: passthroughFunctionWrap(clearTimeout),
		setInterval: passthroughFunctionWrap(setInterval),
		clearInterval: passthroughFunctionWrap(clearInterval),
		req: createObjectSandbox(serverRequestSandbox, context.req),
		res: createObjectSandbox(serverResponseSandbox, context.res),
		haiku: {
			getContextDataOf: passthroughFunctionWrap(haiku_extensions.getContextDataOf),
			getCurrentContextData: passthroughFunctionWrap(haiku_extensions.getCurrentContextData)
		}
	};

	// add custom add-ons to the sandbox (e.g. 'console')

	if (addons)
		for (var i in addons)
			context.sandbox[i] = addons[i];

	return context.sandbox;
}

function enterModuleSandbox(NativeModule) {

	var global = (function () { return this; }).call(null)

	// Sandbox process.nextTick as an entry point to user code

	oldNextTick = process.nextTick
	process.nextTick = function (func) {
		return oldNextTick(userFunctionWrap(func))
	}

	// Sandbox setTimeout as an entry point to user code

	oldSetTimeout = global.setTimeout
	global.setTimeout = function () {
		var newArguments = [ userFunctionWrap(arguments[0]) ];
		for (var i = 1; i < arguments.length; i++)
			newArguments.push(arguments[i])
		return oldSetTimeout.apply(this, newArguments)
	}

	// Sandbox setInterval as an entry point to user code

	oldSetInterval = global.setInterval
	global.setInterval = function () {
		var newArguments = [ userFunctionWrap(arguments[0]) ];
		for (var i = 1; i < arguments.length; i++)
			newArguments.push(arguments[i])
		return oldSetInterval.apply(this, newArguments)
	}

	// Sandbox the module system

	var inRequireEpisode = false

	// Force all native modules to be loaded in their own context.
	// Native modules are by default loaded in the main V8 context. We need to override this logic
	// to load native modules in their own V8 context instead, such that each copy of a native module
	// can be assigned to one particular handler instance

	var oldRequire = NativeModule.require

	NativeModule.require = function () {
		var enteredRequireEpisode = false;
		var contextHook
		if (!inRequireEpisode) {
			inRequireEpisode = enteredRequireEpisode = true;
			for (var i in NativeModule._cache) 
				delete NativeModule._cache[i];
		}
		try {
			return oldRequire.apply(this, arguments);
		}
		finally {
			if (enteredRequireEpisode) 
				inRequireEpisode = false
		}
	}

	// Modify all native modules to add __haiku_hook object to their exports. 
	// This object will be created in the V8 context in which the module is loaded.
	// This object is used in the NativeModule.prototype.compile overload 
	// to associate context data with the module context.

	// See comment in module.prototype._compile to understand the following logic

	NativeModule.wrapper[0] += ' module.exports.__haiku_hook = {}; '

	NativeModule.prototype.compile = function() {
		var source = NativeModule.getSource(this.id)
		source = NativeModule.wrap(source);

		var ctx = vm.createContext(global)
		var fn = vm.runInContext(source, ctx, this.filename)
		fn(this.exports, NativeModule.require, this, this.filename)

		var contextDataSet
		var currentContextData = haiku_extensions.getCurrentContextData()
		var contextHook = this.exports['__haiku_hook'] || this.exports
		if (currentContextData) {
			if (typeof contextHook !== 'object' && typeof contextHook !== 'function') 
				throw new Error('Internal error. Unable to determine the context hook of the native module ' + this.id + '.')

			// Some native modules (e.g. constants) expose bindings created in main context; treat them as trusted.
			// TODO: this is a potential security issue if such objects leak to the user space. See #10.

			if (haiku_extensions.getContextDataOf(contextHook) !== 'MainContext') {
				haiku_extensions.setContextDataOn(contextHook, currentContextData)
				contextDataSet = true
			}
		} 

		if (this.id === 'events' && moduleSandbox[this.id] && contextDataSet) {
			var sandbox = moduleSandbox[this.id]
			var objectToSandbox = this.exports
			this.exports = haiku_extensions.runInObjectContext(
				contextHook,
				function () { 
					return createObjectSandbox(sandbox, objectToSandbox)
				}
			)
		}

		this.loaded = true;
	}

	// Force all user modules to be loaded in their own V8 context. 
	// This is used to establish association of any executing code with a particular
	// handler invocation that loaded that code by assigning a custom identifier 
	// to the V8 context's context data field. 

	module._contextLoad = true

	var originalCompile = module.prototype._compile

	module.prototype._compile = function (content, filename) {
		// remove shebang
		content = content.replace(/^\#\!.*/, '');		

		// Modify module content to add __haiku_hook object to the exports. 
		// This object will be created in the V8 context in which the module is loaded.
		// This object is used in the Module._load overload to associate context data 
		// with the module context.

		// This is a bit tricky for 2 reasons:
		// 1. The __haiku_hook must be created on the module's exports before any
		//    other submodules are loaded, since sub-modules may have cyclic
		//    dependencies. If such a dependency exists, module._load must be able to 
		//    access the __haiku_hook property of the partially constructed module; 
		//    this is why __haiku_hook is created first thing in the module code.
		// 2. Some modules replace the entire module.exports object with its own 
		//    rather than adding properties to it. For such modules the __haiku_hook
		//    property will be absent in module._load - in that case module_load 
		//    will attempt to fall back on the module.exports object as an object created in 
		//    in the V8 creation context of the module.

		content = 'module.exports.__haiku_hook = {};' + content
		var result = originalCompile.call(this, content, filename);

		return result;
	}
	
	var originalLoad = module._load

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

		var enteredRequireEpisode = false
		if (!inRequireEpisode) {
			inRequireEpisode = enteredRequireEpisode = true
			for (var i in module._cache) 
				delete module._cache[i]
			for (var i in NativeModule._cache) 
				delete NativeModule._cache[i]
		}

		try {
			if (!moduleSandbox[request] && !request[0] === '.' && !request === 'querystring')
				// request module requires its own 'querystring' without a dot
				throw 'Module ' + request + ' is not available in the haiku-http sandbox.'

			var result = originalLoad(request, parent, isMain)

			var contextHook = result['__haiku_hook'] || result

			if (typeof contextHook !== 'object' && typeof contextHook != 'function')
				throw new Error('Internal error. Unable to determine the context hook of the module ' + request + '.')

			if (!NativeModule.getCached(request)) {

				// Native modules have their identity set in NativeModule.compile. 
				// This code path is for userland JavaScript modules only. 

				// The module object itself is created in the main V8 context, while all its properties are created in 
				// a separate (user) V8 context (since module._contextLoad was set to true above). One of these
				// properties is __haiku_hook retrieved above (its existence is enforced in module.prototype._compile above).

				// Propagate the identity of the handler code that started this 'require episode'
				// to the V8 context in which the module code had been created. 

				var currentContextData = haiku_extensions.getCurrentContextData()

				if (typeof currentContextData !== 'string')
					throw new Error('Unable to obtain current context data to enforce it on module ' + request + '.');

				haiku_extensions.setContextDataOn(contextHook, currentContextData)
			}

			// Create sandbox wrapper around the module in the module's V8 creation context

			if (moduleSandbox[request]) 
				result = haiku_extensions.runInObjectContext(
					contextHook,
					function () { 
						return createObjectSandbox(moduleSandbox[request], result)
					}
				)

			// From now on, all functions defined in the module can be attributted to a particular handler invocation
			// by looking at a function's V8 creation context's context data using haiku_extensions.getContextDataOf(func)

			return result
		}
		finally {
			if (enteredRequireEpisode) 
				inRequireEpisode = false
		}
	}
}

exports.createSandbox = createSandbox;
exports.wrapFunction = wrapFunction;
exports.enterModuleSandbox = enterModuleSandbox;