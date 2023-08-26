const mongoose = require('mongoose')

const PhoneSchema = new mongoose.Schema({
    companyId: mongoose.Types.ObjectId,
    tfn: String,
    areaCode: String,
    state: String,
    region: String,
    top15AreaCode: Boolean,
    att: String,
    attBranded: Boolean,
    tmobile: String,
    tmobileBranded: Boolean,
    verizon: String,
    verizonBranded: Boolean,
    businessCategory: String
}, {
    timestamps: true,
})

module.exports = mongoose.model("Phones", PhoneSchema);
