const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { validateFullName, validateEmail } = require('../utils/validators')
const { badRequest, ok, created, error, unauthorized } = require('../utils/responses')
const { JWT_EXPIRATION, PASSWORD_ROUNDS } = require('../utils/constants')

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
                token,
            })
        } catch (e) {
            return error(response, e)
        }
    })

module.exports = router
