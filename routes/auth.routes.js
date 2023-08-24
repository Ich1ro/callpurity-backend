const express = require('express')
const router = express.Router()
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { validateFullName, validateEmail } = require('../utils/validators')

router
    .post('/register', async (request, response) => {
        try {
            if (!validateFullName(request.body.fullName) || !validateEmail(request.body.email) || !validateFullName(request.body.password)) {
                response.status(400).json({
                    message: "Invalid Credentials"
                })
                return
            }
            const existed = await User.exists({ email: request.body.email })
            if (existed !== null) {
                response.status(400).json({
                    message: "User Already Exists"
                })
                return
            }

            const hashedPassword = await bcrypt.hash(request.body.password, 10)
            const user = new User({
                fullName: request.body.fullName,
                email: request.body.email,
                password: hashedPassword,
            });
    
            try {
                await user.save()
                response.status(201).json({
                    message: "User Created Successfully"
                })
            } catch (e) {
                response.status(500).json({
                    message: "Internal server error"
                })
                console.error(e)
            }
        } catch (e) {
            response.status(500).json({
                message: "Internal server error"
            })
            console.error(e)
        }
    })
    .post('/login', async (request, response) => {
        try {
            if (!validateEmail(request.body.email)) {
                response.status(400).json({
                    message: "Invalid Credentials"
                })
                return
            }
            const user = await User.findOne({ email: request.body.email })
            if (user === null || user === undefined) {
                response.status(404).send({
                    message: "Invalid credentials"
                })
                return
            }
            const passwordCheck = await bcrypt.compare(request.body.password, user.password)
            if (!passwordCheck) {
                response.status(404).json({
                    message: "Invalid credentials"
                })
                return
            }

            const token = jwt.sign(
                {
                    userId: user._id,
                    userEmail: user.email,
                },
                process.env.JWT_SECRET,
                { expiresIn: "24h" }
            );

            response.status(200).json({
                message: "Login Successful",
                email: user.email,
                fullName: user.fullName,
                token,
            });
        } catch (e) {
            response.status(500).json({
                message: "Internal server error"
            })
            console.error(e)
        }
    })

module.exports = router
