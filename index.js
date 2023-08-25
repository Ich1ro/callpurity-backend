const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log('DB connect'))
    .catch((error) => console.log('DB error', error))

const app = express()

app.use(express.json())
app.use(cors())

const auth = require('./routes/auth.routes')
app.use(auth)

const client = require('./routes/client.routes')
app.use(client)

app.listen(process.env.PORT || 3001, (error) => {
    if (error) {
        return console.log(error);
    } else {
        console.log('Server Ok')
    }
})
