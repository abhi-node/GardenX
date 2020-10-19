const mongoose = require('mongoose')
const Schema = mongoose.Schema 

//create user schema + model
const UserSchema = new Schema({
    username: {
        type: String,
        required: [true, 'username require']
    },
    email: {
        type: String,
        require: [true, 'email required']
    },
    password: {
        type: String,
        require: [true, 'password required']
    }
    
})

const User = mongoose.model('user', UserSchema)

module.exports = User