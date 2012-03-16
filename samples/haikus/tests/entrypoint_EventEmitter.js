var mongoUrl = 'mongodb://arr:arr@staff.mongohq.com:10024/arr'

var result = [ haiku.getCurrentContextData() ]

require('mongodb').connect(mongoUrl, function (err, db) {
    result.push(haiku.getCurrentContextData())
    if (notError(err))
        db.collection('apps', function (err, apps) {
            result.push(haiku.getCurrentContextData())
            if (notError(err))
                apps.find({}).toArray(function (err, docs) {
                    result.push(haiku.getCurrentContextData())
                    if (notError(err)) {
                        res.writeHead(200)
                        res.end(JSON.stringify(result))
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