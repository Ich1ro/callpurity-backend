const { Readable } = require('stream')
var csv = require("csvtojson")

exports.parseCsv = function (file, map, add) {
    const stream = Readable.from(file.buffer)
    return new Promise((resolve, reject) => {
        try {
            let objs = []
            csv().fromStream(stream).subscribe(json => {
                const transformed = {}
                map && Object.entries(map).forEach(entry => {
                    const value = entry[1].compute ? entry[1].compute(json[entry[0]]) : json[entry[0]]
                    entry[1].key && (transformed[entry[1].key] = value)
                })

                add && Object.entries(add).forEach(entry => {
                    transformed[entry[0]] = entry[1]
                })
                objs.push(transformed)
            }, e => reject(e), () => resolve(objs))
        } catch(e) {
            reject(e)
        }
    })
}