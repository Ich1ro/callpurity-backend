const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const Client = require('../models/Client')
const { validateFullName, validateEmail, validateNames, validateFile } = require('../utils/validators')
const { badRequest, ok, created, error, unauthorized } = require('../utils/responses')
const { JWT_EXPIRATION, PASSWORD_ROUNDS } = require('../utils/constants')
const { sendEmail } = require('../utils/email')

router
    .post('/register', async (request, response) => {
        try {
            if (!validateFullName(request.body.fullName) || !validateEmail(request.body.email) || !validateFullName(request.body.password)) {
                return badRequest(response, { message: 'Invalid Credentials' })
            }
            const existed = await User.exists({ email: request.body.email })
            if (existed !== null) {
                return badRequest(response, { message: 'User Already Exists' })
            }

            const hashedPassword = await bcrypt.hash(request.body.password, PASSWORD_ROUNDS)
            const user = new User({
                fullName: request.body.fullName,
                email: request.body.email,
                password: hashedPassword,
            });

            try {
                await user.save()
                return created(response, { message: 'User Created Successfully' })
            } catch (e) {
                return error(response, e)
            }
        } catch (e) {
            return error(response, e)
        }
    })
    .post('/login', async (request, response) => {
        try {
            if (!validateEmail(request.body.email)) {
                return badRequest(response, { message: 'Invalid Credentials' })
            }
            const user = await User.findOne({ email: request.body.email })
            if (user === null || user === undefined) {
                return notFound(response, { message: 'Invalid Credentials' })
            }
            const passwordCheck = await bcrypt.compare(request.body.password, user.password)
            if (!passwordCheck) {
                return unauthorized(response, { message: 'Invalid Credentials' })
            }

            let companyId = undefined
            if (!user.admin) {
                const client = await Client.findOne( { userId: user._id }, { _id: 1 })
                client && (companyId = client._id)
            }

            const token = jwt.sign(
                {
                    userId: user._id,
                    userEmail: user.email
                },
                process.env.JWT_SECRET,
                { expiresIn: JWT_EXPIRATION }
            );

            return ok(response, {
                message: "Login Successful",
                email: user.email,
                fullName: user.fullName,
                admin: user.admin,
                companyId,
                token,
            })
        } catch (e) {
            return error(response, e)
        }
    })
    .post('/feedback', async (request, response) => {
        const body = request.body
        const validate = validateNames(body.companyName, 1000, 1) &&
                         validateNames(body.description, 10000, 1) &&
                         validateFullName(body.firstName) &&
                         validateEmail(body.email) &&
                         (!request.file || validateFile(request.file, ['.csv', '.xls', '.xlsx', '.doc', '.docx', '.txt']))

        if (!validate) {
            return badRequest(response, { message: 'Validation failed' })
        }

        let attachment = undefined
        if (request.file) {
            attachment = {
                name: request.file.originalname ?? 'Attachment',
                value: request.file.buffer.toString('base64')
            }
        }
        
        const result = await sendEmail(
            body.firstName,
            body.email,
            'Callpurity',
            process.env.EMAIL,
            'Moves, Adds & Changes - ' + body.companyName,
            `
                <html>
                    <body>
                       <b>Company Name: </b>${body.companyName}<br/>
                       <b>Contact Person Name: </b>${body.firstName}<br/>
                       ${body.goLiveDate !== undefined && body.goLiveDate !== null ? '<b>Go Live Date: </b>' + new Date(body.goLiveDate)?.toISOString()?.split('T')[0] + '<br/>' : ''}
                       <b>Description:</b><br/>
                       ${body.description}
                    </body>
                <html>
            `,
            attachment
        )

        if (result.status === 500) {
            console.error(result.reason)
            return badRequest(response, { message: 'Error occured during sending email' })
        }

        return ok(response, { message: 'Email is successfully sent' })
    })

module.exports = router
