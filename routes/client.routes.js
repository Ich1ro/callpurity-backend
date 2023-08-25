const express = require('express')
const router = express.Router()
const User = require('../models/User')
const Client = require('../models/Client')
const { expressjwt: jwt } = require('express-jwt')
const bcrypt = require('bcrypt')
const { validateFullName, validateEmail, validateNames, validateZipCode, validatePhone } = require('../utils/validators')
const { badRequest, ok, created, error, unauthorized } = require('../utils/responses')
const { generateString } = require('../utils/generators')
const { PASSWORD_ROUNDS } = require('../utils/constants')
const { sendEmail } = require('../utils/email')
const { default: mongoose } = require('mongoose')

router
    .post('/clients', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        let session = null
        try {
            const body = request.body
            const validation = validateNames(body.companyName, 500, 1) ||
                validateNames(body.address, 1000, 1) ||
                validateNames(body.city, 500, 1) ||
                validateNames(body.state, 500, 1) ||
                validateZipCode(body.zipCode) ||
                validateFullName(body.contactPerson) ||
                validateEmail(body.email) ||
                validatePhone(body.phone)

            if (!validation) {
                return badRequest(response, { message: 'Validation has not passed' })
            }

            const authUser = await User.findById(request.auth?.userId, { admin: 1 })
            if (!authUser?.admin) {
                return unauthorized(response, { message: 'User is not allowed to perform this action' })
            }

            const clientExists = await Client.exists({ companyName: body.companyName })
            if (clientExists?._id) {
                return badRequest(response, { message: 'Company with the provided name already registerd' })
            }

            session = await mongoose.startSession();
            session.startTransaction();

            const userForCompany = await User.exists({ email: body.email })
            let userId = null
            if (userForCompany?._id) {
                userId = userForCompany._id
            } else {
                const password = generateString(10)
                const hashedPassword = await bcrypt.hash(password, PASSWORD_ROUNDS)
                const result = await sendEmail(
                    'Callpurity',
                    'callpurity@gmail.com',
                    body.contactPerson,
                    body.email,
                    'Password for new contact person',
                    `
                        <html>
                            <body>
                                <p>Dear ${body.contactPerson},</p>
                                <p>Your new password is: <b>${password}</b></p>
                                <h4>Please, keep this password in secret!</h4>
                                <p>Callpurity</p>
                            </body>
                        <html>
                    `
                )

                if (result.status === 500) {
                    console.error(result.reason)
                    return badRequest(response, { message: 'Error occured during sending email' })
                }
                const insertedUser = await User.create({
                    fullName: body.contactPerson,
                    email: body.email,
                    password: hashedPassword,
                    admin: false
                })

                userId = insertedUser._id
            }

            const insertedClient = await Client.create({
                userId,
                companyName: body.companyName,
                address: body.address,
                city: body.city,
                state: body.state,
                zipCode: body.zipCode,
                phone: body.phone,
                registrationDate: new Date().toISOString()
            })

            await session.commitTransaction();
            await session.endSession();

            return created(response, { _id: insertedClient._id })

        } catch (e) {
            if (session) {
                await session.abortTransaction();
                await session.endSession();
            }
            return error(response, e)
        }
    })

    .get('/clients', jwt({ secret: process.env.JWT_SECRET, algorithms: ["HS256"] }), async (request, response) => {
        try {
            const page = parseInt(request.query.page ?? 0)
            const limit = parseInt(request.query.limit ?? 10)
            const search = request.query.search
            const sortBy = request.query.sortBy ?? 'companyName'
            const sortDir = request.query.sortDir ?? 'asc'

            const authUser = await User.findById(request.auth?.userId, { admin: 1 })
            const isAdmin = authUser?.admin
            let match = { companyName: { $regex: new RegExp(search, 'i') } }
            isAdmin || (match = { ...match, userId: new mongoose.Types.ObjectId(request.auth.userId) })
            const amount = await Client.countDocuments(match)
            const pages = parseInt(Math.ceil(amount / limit))

            const clients = await Client.aggregate([
                { $match: match },
                { $sort: { [sortBy]: sortDir === 'desc' ? -1 : 1 } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $set: {
                        fullName: '$user.fullName',
                        email: '$user.email'
                    }
                },
                {
                    $project: {
                        userId: 0,
                        user: 0,
                        __v: 0
                    }
                },
                { $skip: limit * page },
                { $limit: limit }
            ]).collation({
                locale: 'en',
                caseLevel: true
            })

            return ok(response, {
                items: clients,
                total: amount,
                pages: pages
            })

        } catch (e) {
            return error(response, e)
        }
    })

module.exports = router