var fs = require('fs');

require('http').createServer(function (req, res) {
	try {
		console.log(__dirname + '/haikus' + req.url);
		file = fs.readFileSync(__dirname + '/haikus' + req.url + '.js');
		res.writeHead(200);
		res.end(file);
	}
	catch (e) {
		res.writeHead(404);
		res.end();
	}
}).listen(8000)

console.log('haiku-http sample server listening on http://localhost:8000. Ctrl-C to terminate.');