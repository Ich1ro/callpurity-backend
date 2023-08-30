const mongoose = require('mongoose')
const { MAX_FILE_SIZE } = require('./constants')
const path = require('path')

exports.validateFullName = value => {
    return !(value === null ||
        value === undefined ||
        /^\s*$/.test(value) ||
        value.length > 500)
}

exports.validateEmail = value => {
    return !(value === null ||
        value === undefined ||
        /^\s*$/.test(value) ||
        !String(value).toLowerCase().match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/))
}

exports.validatePassword = value => {
    return !(value === null ||
        value === undefined ||
        !String(value).match(/^(?=.*\d)(?=.*[A-Z])(?=.*[a-z])(?=.*[^\w\d\s:])([^\s]){8,16}$/gm)
    )
}

exports.validateNames = (value, maxLength, minLength) => {
    return !(value === null ||
        value === undefined ||
        /^\s*$/.test(value) ||
        value.length > maxLength ||
        value.length < minLength)
}

exports.validateZipCode = value => {
    return !(value === null ||
        value === undefined ||
        !/^[0-9]{5}(?:-[0-9]{4})?$/.test(value))
}

exports.validatePhone = value => {
    return !(value === null ||
        value === undefined ||
        !/^\+?[1-9][0-9]{7,14}$/.test(value))
}

exports.validateId = value => {
    if (value === null || value === undefined || /^\s*$/.test(value)) {
        return false
    }
    if (mongoose.Types.ObjectId.isValid(value)) {
        return (String)(new mongoose.Types.ObjectId(value)) === value
    }

    return false
}

exports.validateFile = (file, allowedExtensions) => {
    if (!file || file.size > MAX_FILE_SIZE || !allowedExtensions.includes(path.extname(file.originalname)?.toLowerCase())) {
        return false
    }
    return true
}

exports.validateAreaCode = value => {
    return value !== null && value !== undefined && (value.length === 2 || value.length === 3) && value[0] !== '0' && !isNaN(value[0]) && !isNaN(value[1]) && !isNaN(value[2])
}

exports.validateBoolean = value => {
    return value === true || value === false
}