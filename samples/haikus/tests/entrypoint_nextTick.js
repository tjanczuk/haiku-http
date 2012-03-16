res.writeHead(200)
var result = [haiku.getCurrentContextData()]
process.nextTick(function () {
	result.push(haiku.getCurrentContextData())
	res.end(JSON.stringify(result))
})