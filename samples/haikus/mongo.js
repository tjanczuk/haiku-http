// Connect to MongoDB instance at MongoHQ and return the result of a query.
// The request URL can be parametrized with the 'host' parameter which
// (if present) will be passed as filter to the MongoDB database. 
//
// Try the following invocations for different results:
//
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/mongo.js
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/mongo.js&host=app1.com
// ?x-haiku-handler=https://raw.github.com/tjanczuk/haiku-http/master/samples/haikus/mongo.js&host=app2.com

var query = require('url').parse(req.url, true).query
var mongoUrl = query['db'] || 'mongodb://arr:arr@staff.mongohq.com:10024/arr'
var filter = query['host'] ? { hosts: query['host'] } : {}

require('mongodb').connect(mongoUrl, function (err, db) {
    if (notError(err))
        db.collection('apps', function (err, apps) {
            if (notError(err))
                apps.find(filter).toArray(function (err, docs) {
                    if (notError(err)) {
                        res.writeHead(200)
                        res.end(JSON.stringify(docs))
                    }
                })
        })
})

function notError(err) {
    if (err) {
        res.writeHead(500)
        res.end(err)
    }
    return !err
}