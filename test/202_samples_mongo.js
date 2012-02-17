var request = require('request');

module.exports = {
	'mongo sample returns two documents by default': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') !== -1)
			assert.ok(body.indexOf('app2.com') !== -1)
		})
	},
	'mongo sample returns one document for app1.com': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=app1.com', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') !== -1)
			assert.ok(body.indexOf('app2.com') === -1)
		})
	},
	'mongo sample returns one document for app2.com': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=app2.com', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') === -1)
			assert.ok(body.indexOf('app2.com') !== -1)
		})
	},
	'mongo sample returns no documents for foobar': function (beforeEnd, assert) {
		request('http://localhost?x-haiku-handler=http://localhost:8000/mongo&host=foobar', function (err, res, body) {
			assert.isNull(err)
			assert.equal(res.statusCode, 200)
			assert.ok(body.indexOf('app1.com') === -1)
			assert.ok(body.indexOf('app2.com') === -1)
		})
	}
}