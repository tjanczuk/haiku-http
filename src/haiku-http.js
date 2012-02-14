var cluster = require('cluster')
	, fs = require('fs')

var argv = require('optimist')
	.usage('Usage: $0')
	.options('w', {
		alias: 'workers',
		description: 'Number of worker processes',
		default: require('os').cpus().length * 4
	})
	.options('p', {
		alias: 'port',
		description: 'HTTP listen port',
		default: 80
	})
	.options('s', {
		alias: 'sslport',
		description: 'HTTPS listen port',
		default: 443
	})
	.options('c', {
		alias: 'cert',
		description: 'Server certificate for SSL',
		default: './cert.pem'
	})
	.options('k', {
		alias: 'key',
		description: 'Private key for SSL',
		default: './key.pem'
	})
	.options('x', {
		alias: 'proxy',
		description: 'HTTP proxy in host:port format for outgoing requests',
		default: ''
	})
	.options('i', {
		alias: 'maxsize',
		description: 'Maximum size of a handler in bytes',
		default: '16384'
	})
	.options('t', {
		alias: 'maxtime',
		description: 'Maximum clock time in milliseconds for handler execution',
		default: '5000'
	})
	.options('r', {
		alias: 'maxrequests',
		description: 'Number of requests before process recycle. Zero for no recycling.',
		default: '1'
	})
	.options('a', {
		alias: 'keepaliveTimout',
		description: 'Maximum time in milliseconds to receive keepalive response from worker',
		default: '5000'
	})
	.options('v', {
		alias: 'keepaliveInterval',
		description: 'Interval between keepalive requests',
		default: '5000'
	})
	.options('l', {
		alias: 'maxConsole',
		description: 'Maximum console buffer in bytes. Zero for unlimited.',
		default: '4096'
	})
	.check(function (args) { return !args.help; })
	.check(function (args) { return args.p != args.s; })
	.check(function (args) {
		args.cert = fs.readFileSync(args.c);
		args.key = fs.readFileSync(args.k);
		return true;
	})
	.check(function (args) {
		var proxy = args.x === '' ? process.env.HTTP_PROXY : args.x;
		if (proxy) {
		    var i = proxy.indexOf(':');
		    args.proxyHost = i == -1 ? proxy : proxy.substring(0, i),
		    args.proxyPort = i == -1 ? 80 : proxy.substring(i + 1)
		}
		return true;
	})
	.argv;

if (cluster.isMaster)
	require('./master.js').main(argv);
else
	require('./worker.js').main(argv);
