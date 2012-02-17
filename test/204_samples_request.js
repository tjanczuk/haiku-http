var request = require('request');

module.exports = {
	'https.js sample returns a response from github.com': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/request', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('"the"') !== -1);
		}),
		request('http://localhost?x-haiku-handler=http://localhost:8000/request&word=economy', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('"economy"') !== -1);
		})
	}
}