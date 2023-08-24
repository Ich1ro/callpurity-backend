exports.created = (response, json) => response.status(201).json(json)
exports.ok = (response, json) => response.status(200).json(json)
exports.badRequest = (response, json) => response.status(400).json(json)
exports.unauthorized = (response, json) => response.status(401).json(json)
exports.notFound = (response, json) => response.status(404).json(json)
exports.error = (response, error) => {
    console.error(error);
    response.status(500).json({ message: 'Internal Server Error' })
}