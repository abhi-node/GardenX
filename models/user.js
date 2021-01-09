const mongoose = require('mongoose')
const Schema = mongoose.Schema 

//create user schema + model
const UserSchema = new Schema({
    username: {
        type: String,
        required: [true, 'username required']
    },
    email: {
        type: String,
        require: [true, 'email required']
    },
    password: {
        type: String,
        require: [true, 'password required']
    },
    joinDate: {
        type: Date,
        required: [true, 'Join Date is required']
    },
    imagePublic: {
        type: Boolean,
        default: true
    }


    
})

const User = mongoose.model('user', UserSchema, 'user')

module.exports = User