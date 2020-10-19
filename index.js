const express = require('express')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
var urlparser = bodyParser.urlencoded({ extended: false})

mongoose.connect('mongodb://localhost/users')

mongoose.Promise = global.Promise

app.get('/root', (req, res) => {
    res.sendFile(path.join(__dirname + '/html/index.html'))
})

app.get('/root/login', (req, res) => {
    User.findOne({email: req.email, password: req.password})
    res.sendFile(path.join(__dirname + '/html/home.html'))
})

app.post('/root/login', urlparser, (req, res) => {
    User.create(req.body)
    res.sendFile(path.join(__dirname + '/html/home.html'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
