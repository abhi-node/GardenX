const mongoose = require('mongoose')
const Schema = mongoose.Schema 

const NotifSchema = new Schema({
    type: String,
    sender: String,
    receivers: [String],
    sent: {type:Date, default:Date.now},
    msg: String,
    image: String,
})

const Notification = mongoose.model('notification', NotifSchema, 'notifications')

module.exports = Notification
