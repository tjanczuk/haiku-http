res.writeHead(200)
var result = [haiku.getCurrentContextData()]
var i = setInterval(function () {
	clearInterval(i)
	result.push(haiku.getCurrentContextData())
	res.end(JSON.stringify(result))
}, 1)