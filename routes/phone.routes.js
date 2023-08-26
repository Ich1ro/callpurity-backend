const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Phone = require('../models/Phone')
const path = require('path')
const { expressjwt: jwt } = require('express-jwt')
const { badRequest, ok, created, error, unauthorized } = require('../utils/responses')
const { default: mongoose } = require('mongoose')
const { validateId } = require('../utils/validators')
const { MAX_FILE_SIZE } = require('../utils/constants')
const { parseCsv } = require('../utils/upload')

router
    .post('/numbers', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const companyId = request.query?.id
            if (!validateId(companyId)) {
                return badRequest(response, { message: 'Incorrect id was provided' })
            }

            const file = request.file
            if (!file) {
                return badRequest(response, { message: 'File must be uploaded' })
            }

            if (file.size > MAX_FILE_SIZE) {
                return badRequest(response, { message: 'File size cannot be greater than 100MB' })
            }

            if (path.extname(file.originalname)?.toLowerCase() !== '.csv') {
                return badRequest(response, { message: 'File with extension .csv is only allowed' })
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

            const result = await parseCsv(file, {
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

            let match = { companyId: new mongoose.Types.ObjectId(companyId), tfn: { $regex: new RegExp(search, 'i') } }
            branded && (match = {
                ...match, $expr: {
                    $or: [
                        { $eq: ['$attBranded', branded === 'true' ? true : false] },
                        { $eq: ['$tmobileBranded', branded === 'true' ? true : false] },
                        { $eq: ['$verizonBranded', branded === 'true' ? true : false] },
                    ]
                }
            })
            const amount = await Phone.countDocuments(match)
            const pages = parseInt(Math.ceil(amount / limit))

            if (page > pages) {
                return badRequest(response, { message: 'Page incorrect' })
            }

            const phones = await Phone.aggregate([
                { $match: match },
                { $project: { __v: 0 }},
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

module.exports = router