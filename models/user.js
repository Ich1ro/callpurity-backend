const mongoose = require('mongoose')

const UserSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    password: String,
    avatarUrl: String
}, {
    timestamps: true,
})

module.exports = mongoose.model("Users", UserSchema);
