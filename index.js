const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const User = require('./models/user')
const cors = require('cors')
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URL)
.then(() => console.log('DB connect'))
.catch((error) => console.log('DB error', error))

const app = express()

app.use(express.json())
app.use(cors())

app.post("/register", (request, response) => {
    bcrypt
    .hash(request.body.password, 10)
    .then((hashedPassword) => {
    const user = new User({
        fullName:request.body.fullName,
        email: request.body.email,
        password: hashedPassword,
    });

    user
        .save()
        .then((result) => {
        response.status(201).send({
            message: "User Created Successfully",
            result,
        });
        })
        .catch((error) => {
        response.status(500).send({
            message: "Error creating user",
            error,
        });
        });
    })
    .catch((e) => {
    response.status(500).send({
        message: "Password was not hashed successfully",
        e,
    });
    });
});

app.post("/login", (request, response) => {
User.findOne({ email: request.body.email })

    .then((user) => {
    bcrypt
        .compare(request.body.password, user.password)

        .then((passwordCheck) => {

        if(!passwordCheck) {
            return response.status(400).send({
            message: "Passwords does not match",
            error,
            });
        }

        const token = jwt.sign(
            {
            userId: user._id,
            userEmail: user.email,
            },
            "RANDOM-TOKEN",
            { expiresIn: "24h" }
        );

        response.status(200).send({
            message: "Login Successful",
            email: user.email,
            fullName: user.fullName,
            token,
        });
        })
        .catch((error) => {
        response.status(400).send({
            message: "Passwords does not match",
            error,
        });
        });
    })
    .catch((e) => {
    response.status(404).send({
        message: "Email not found",
        e,
    });
    });
});
  

app.listen(process.env.PORT || 3001, (error) => {
    if(error) {
        return console.log(error);
    } else {
        console.log('Server Ok')
    }
})
