res.writeHead(200)
var result = [haiku.getCurrentContextData()]
setTimeout(function () {
	result.push(haiku.getCurrentContextData())
	res.end(JSON.stringify(result))
}, 1)