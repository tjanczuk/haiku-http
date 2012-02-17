var request = require('request');
var mongodb = require('mongodb');

module.exports = {
	'haiku-http service is running': function (beforeEnd, assert) {
		request('http://localhost', function (err, res, body) {
			assert.isNull(err, 'haiku-http service is running at http://localhost')
			assert.equal(res.statusCode, 400, 'haiku-http service is running at http://localhost')
		})
	},
	'haiku script service is running': function (beforeEnd, assert) {
		request('http://localhost:8000/hello', function (err, res, body) {
			assert.isNull(err, 'haiku sample script service is running on http://localhost:8000')
			assert.equal(res.statusCode, 200, 'haiku sample script service is running on http://localhost:8000')
		})
	},
	'internet connection is available': function (beforeEnd, assert) {
		request('http://www.google.com', function (err, res, body) {
			assert.isNull(err, 'internet connection is available')
			assert.equal(res.statusCode, 200, 'internet connection is available')
		})		
	},
	'mongodb database is accesible': function (beforeEnd, assert) {
		mongodb.connect('mongodb://arr:arr@staff.mongohq.com:10024/arr', function (err, db) {
			assert.isNull(err, 'MongoDB database at mongodb://arr:arr@staff.mongohq.com:10024/arr is accessible')
			db.close();
		})
	}
}