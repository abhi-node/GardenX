const mongoose = require('mongoose')
const mongooseUniqueValidator = require('mongoose-unique-validator')
const Schema = mongoose.Schema 

//create user schema + model
const UserSchema = new Schema({
    username: {
        type: String,
        required: [true, 'username required'],
        unique: [true, "Username already taken"]
    },
    email: {
        type: String,
        require: [true, 'email required'],
        unique: [true, "Email already taken"]
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

UserSchema.plugin(mongooseUniqueValidator)

const User = mongoose.model('user', UserSchema, 'user')

module.exports = User