var request = require('request');

module.exports = {
	'https.js sample returns a response from github.com': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/https', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('GitHub') !== -1);
		})
	}
}