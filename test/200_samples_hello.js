var request = require('request');

module.exports = {
	'hello.js sample returns Hello, world': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/hello', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.equal(body, 'Hello, world!\n')
		})
	}
}