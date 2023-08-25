const mongoose = require('mongoose')

const ClientSchema = new mongoose.Schema({
    userId: mongoose.Types.ObjectId,
    companyName: String,
    address: String,
    city: String,
    state: String,
    zipCode: Number,
    phone: String,
    registrationDate: Date,
    status: String
}, {
    timestamps: true,
})

module.exports = mongoose.model("Clients", ClientSchema);
