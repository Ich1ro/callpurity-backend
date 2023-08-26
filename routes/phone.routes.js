const express = require('express')
const router = express.Router()
const Phone = require('../models/Phone')
const path = require('path')
const { expressjwt: jwt } = require('express-jwt')
const { badRequest, ok, created, error } = require('../utils/responses')
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

module.exports = router