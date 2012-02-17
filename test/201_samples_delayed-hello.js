var request = require('request');

module.exports = {
	'delayed-hello.js sample returns two lines of text': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/delayed-hello', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('Hello') !== -1)
			assert.ok(body.indexOf('world') !== -1)
		})
	}
}