const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Phone = require('../models/Phone')
const { json2csv } = require('json-2-csv');
const { expressjwt: jwt } = require('express-jwt')
const { badRequest, ok, created, error, unauthorized, notFound } = require('../utils/responses')
const { default: mongoose } = require('mongoose')
const { validateId, validatePhone, validateFile, validateAreaCode, validateNames, validateBoolean } = require('../utils/validators')
const { parseCsv } = require('../utils/upload')
const Client = require('../models/Client')

router
    .post('/numbers', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const companyId = request.query?.id
            if (!validateId(companyId)) {
                return badRequest(response, { message: 'Incorrect id was provided' })
            }

            if (!validateFile(request.file, ['.csv'])) {
                return badRequest(response, { message: 'File validation error' })
            }

            const authUser = await User.findById(request.auth?.userId, { admin: 1 })
            const isAdmin = authUser?.admin
            if (!isAdmin) {
                return unauthorized(response, { message: 'User is not allowed to perform this action' })
            }

            const exists = await Phone.exists({ companyId: new mongoose.Types.ObjectId(companyId) })
            if (exists?._id) {
                await Phone.deleteMany({ companyId: new mongoose.Types.ObjectId(companyId) })
            }

            const result = await parseCsv(request.file, {
                'TFN': { key: 'tfn' },
                'Area Code': { key: 'areaCode' },
                'State': { key: 'state' },
                'Region': { key: 'region' },
                'Top 15 Area Code': { key: 'top15AreaCode', compute: value => value === 'N' ? false : true },
                'AT&T': { key: 'att' },
                'AT&T Branded': { key: 'attBranded', compute: value => value === 'N' ? false : true },
                'Tmobile': { key: 'tmobile' },
                'Tmobile Branded': { key: 'tmobileBranded', compute: value => value === 'N' ? false : true },
                'Verizon': { key: 'verizon' },
                'Verizon Branded': { key: 'verizonBranded', compute: value => value === 'N' ? false : true },
                'Business Category': { key: 'businessCategory' }
            }, { companyId: new mongoose.Types.ObjectId(companyId) })

            const inserted = await Phone.insertMany(result)
            return created(response, { message: 'Data was successfully uploaded', ids: inserted.map(it => it._id) })

        } catch (e) {
            return error(response, e)
        }
    })

    .post('/numbers/ftc', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            if (!validateFile(request.file, ['.csv'])) {
                return badRequest(response, { message: 'File validation error' })
            }
            const authUser = await User.findById(request.auth?.userId, { admin: 1 })
            const isAdmin = authUser?.admin
            if (!isAdmin) {
                return unauthorized(response, { message: 'User is not allowed to perform this action' })
            }

            const complainNumbers = (await parseCsv(request.file, {
                'Company_Phone_Number': { key: 'tfn' }
            }))
                .map(it => it.tfn)
                .filter(it => it !== undefined)

            let foundFtc = await Phone.aggregate([
                { $match: { tfn: { $in: complainNumbers } } },
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'companyId',
                        foreignField: '_id',
                        as: 'client'
                    }
                },
                { $unwind: '$client' },
                { $group: { _id: { _id: '$companyId', companyName: '$client.companyName' }, numbers: { $push: { tfn: '$tfn', _id: '$_id' } } } },
            ])

            foundFtc = foundFtc.map(it => ({
                _id: it._id._id,
                companyName: it._id.companyName,
                numbers: it.numbers
            }))

            const numbersToUpdate = []
            foundFtc.forEach(it => {
                it.numbers.forEach(n => {
                    numbersToUpdate.push({ updateOne: { filter: { _id: n._id }, update: { ftcStrikes: true, ftcStrikesLastDate: new Date().toISOString() } } })
                })
            })

            await Phone.bulkWrite(numbersToUpdate)

            return ok(response, {
                total: complainNumbers.length,
                ftcFlagged: numbersToUpdate.length,
                items: foundFtc
            })

        } catch (e) {
            return error(response, e)
        }
    })

    .get('/numbers', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const page = parseInt(request.query.page ?? 0)
            const limit = parseInt(request.query.limit ?? 10)
            const search = request.query.search
            const sortBy = request.query.sortBy ?? 'tfn'
            const sortDir = request.query.sortDir ?? 'asc'
            const companyId = request.query.id
            const branded = request.query.branded

            if (page < 0) {
                return badRequest(response, { message: 'Page incorrect' })
            }

            if (limit < 1 || limit > 1000) {
                return badRequest(response, { message: 'Limit incorrect' })
            }

            if (!validateId(companyId)) {
                return badRequest(response, { message: 'Incorrect id was provided' })
            }

            const authUser = await User.findById(request.auth?.userId, { admin: 1 })
            if (!authUser?.admin) {
                const companies = await Client.find({ userId: request.auth?.userId, _id: new mongoose.Types.ObjectId(companyId) })
                if (companies?.length === 0) {
                    return badRequest(response, { message: 'No company found' })
                }
            }

            let match = { companyId: new mongoose.Types.ObjectId(companyId), tfn: { $regex: new RegExp(search, 'i') } }
            if (branded) {
                branded === 'true' && (match = {
                    ...match, $expr: {
                        $or: [
                            { $eq: ['$attBranded', true] },
                            { $eq: ['$tmobileBranded', true] },
                            { $eq: ['$verizonBranded', true] },
                        ]
                    }
                })

                branded === 'false' && ((match = {
                    ...match, $expr: {
                        $and: [
                            { $eq: ['$attBranded', false] },
                            { $eq: ['$tmobileBranded', false] },
                            { $eq: ['$verizonBranded', false] },
                        ]
                    }
                }))
            }

            const amount = await Phone.countDocuments(match)
            const pages = parseInt(Math.ceil(amount / limit))

            if (page > pages) {
                return badRequest(response, { message: 'Page incorrect' })
            }

            const phones = await Phone.aggregate([
                { $match: match },
                { $project: { __v: 0 } },
                { $sort: { [sortBy]: sortDir === 'desc' ? -1 : 1 } },
                { $skip: limit * page },
                { $limit: limit }
            ]).collation({
                locale: 'en',
                caseLevel: true
            })

            return ok(response, {
                items: phones,
                total: amount,
                pages: pages
            })

        } catch (e) {
            return error(response, e)
        }
    })

    .get('/numbers/download', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const companyId = request.query.id
            if (!validateId(companyId)) {
                return badRequest(response, { message: 'Incorrect id was provided' })
            }

            const authUser = await User.findById(request.auth?.userId, { admin: 1 })
            if (!authUser?.admin) {
                const companies = await Client.find({ userId: request.auth?.userId, _id: new mongoose.Types.ObjectId(companyId) })
                if (companies?.length === 0) {
                    return badRequest(response, { message: 'No company found' })
                }
            }

            const numbers = await Phone.find({ companyId: new mongoose.Types.ObjectId(companyId) }, { _id: 0, __v: 0, companyId: 0 })
            const forCsv = numbers.map(it => ({
                'TFN': it.tfn,
                'Area Code': it.areaCode,
                'State': it.state,
                'Region': it.region,
                'Top 15 Area Code': it.top15AreaCode ? 'Y' : 'N',
                'AT&T': it.att,
                'AT&T Branded': it.attBranded ? 'Y' : 'N',
                'Tmobile': it.tmobile,
                'Tmobile Branded': it.tmobileBranded ? 'Y' : 'N',
                'Verizon': it.verizon,
                'Verizon Branded': it.verizonBranded ? 'Y' : 'N',
                'Business Category': it.businessCategory
            }))
            const csv = await json2csv(forCsv);
            response.set({ "Content-Disposition": "attachment; filename=Phone Numbers.csv", "Content-Type": 'text/csv' });
            response.send(csv);

        } catch (e) {
            return error(response, e)
        }
    })

    .get('/numbers/phone', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            if (!validatePhone(request.query.number)) {
                return badRequest(response, { message: 'Validation failed' })
            }

            const authUser = await User.findById(request.auth?.userId)

            let numbers = await Phone.aggregate([
                { $match: { tfn: request.query.number.trim() } },
                {
                    $lookup: {
                        from: 'clients',
                        localField: 'companyId',
                        foreignField: '_id',
                        as: 'client'
                    }
                },
                { $unwind: '$client' },
                {
                    $set: {
                        companyName: '$client.companyName',
                        state: '$client.state',
                        region: '$client.region',
                        status: '$client.status',
                        userId: '$client.userId'
                    }
                },
                {
                    $project: {
                        companyId: 0,
                        client: 0,
                        __v: 0
                    }
                }
            ]);

            authUser?.admin || (numbers = numbers.filter(it => it.userId.toString() === authUser._id.toString()))

            const number = numbers[0]
            delete number['userId']

            return ok(response, number)
        } catch (e) {
            return error(response, e)
        }
    })

    .get('/numbers/all', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const authUser = await User.findById(request.auth?.userId, { admin: 1, _id: 1 })
            if (!authUser?.admin) {
                const numbers = await Phone.aggregate([
                    {
                        $lookup: {
                            from: 'clients',
                            localField: 'companyId',
                            foreignField: '_id',
                            as: 'client'
                        }
                    },
                    { $unwind: '$client' },
                    { $match: { 'client.userId': authUser._id } },
                    { $project: { tfn: 1, _id: 0 } }
                ])

                return ok(response, numbers)
            }

            const numbers = await Phone.find({}, { tfn: 1, _id: 0 })
            return ok(response, numbers.map(it => it.tfn))

        } catch (e) {
            return error(response, e)
        }
    })
    .patch('/numbers', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const id = request.query.id
            if (!validateId(id)) {
                return badRequest(response, { message: 'Incorrect id was provided' })
            }

            const body = request.body
            const validation = (!body.areaCode || validateAreaCode(body.areaCode)) &&
                (!body.state || validateNames(body.state, 500, 1)) &&
                (!body.region || validateNames(body.region, 500, 1)) &&
                (!body.businessCategory || validateNames(body.businessCategory, 1000, 1)) &&
                (body.top15AreaCode === null || body.top15AreaCode === undefined || validateBoolean(body.top15AreaCode)) &&
                (!body.att || validateNames(body.att, 50, 3)) &&
                (!body.tmobile || validateNames(body.tmobile, 50, 3)) &&
                (!body.verizon || validateNames(body.verizon, 50, 3)) &&
                (body.attBranded === null || body.attBranded === undefined || validateBoolean(body.attBranded)) &&
                (body.tmobileBranded === null || body.tmobileBranded === undefined || validateBoolean(body.tmobileBranded)) &&
                (body.verizonBranded === null || body.verizonBranded === undefined || validateBoolean(body.verizonBranded))

            if (!validation) {
                return badRequest(response, { message: 'Validation failed' })
            }

            const authUser = await User.findById(request.auth?.userId, { admin: 1, _id: 1 })
            if (!numberExists(authUser, id))
                return notFound(response, { message: 'No phone number found' })

            delete request.body['tfn']
            await Phone.findByIdAndUpdate(new mongoose.Types.ObjectId(id), request.body)

            return ok(response, { id })

        } catch (e) {
            return error(response, e)
        }
    })
    .delete('/numbers', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        const id = request.query.id
        if (!validateId(id)) {
            return badRequest(response, { message: 'Incorrect id was provided' })
        }

        const authUser = await User.findById(request.auth?.userId, { admin: 1, _id: 1 })
        if (!numberExists(authUser, id))
            return notFound(response, { message: 'No phone number found' })

        await Phone.findByIdAndDelete(new mongoose.Types.ObjectId(id))

        return ok(response, { id })
    })

async function numberExists(authUser, id) {
    if (!authUser?.admin) {
        const numbers = await Phone.aggregate([
            {
                $lookup: {
                    from: 'clients',
                    localField: 'companyId',
                    foreignField: '_id',
                    as: 'client'
                }
            },
            { $unwind: '$client' },
            { $match: { 'client.userId': authUser._id, _id: new mongoose.Types.ObjectId(id) } },
            { $project: { tfn: 1, _id: 0 } }
        ])

        if (numbers.length === 0) {
            return false
        }
    } else {
        const existing = await Phone.exists({ _id: new mongoose.Types.ObjectId(id) })
        if (!existing) {
            return false
        }
    }

    return true
}

module.exports = router