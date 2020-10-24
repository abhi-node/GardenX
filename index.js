const express = require('express')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
const { allowedNodeEnvironmentFlags } = require('process')
var urlparser = bodyParser.urlencoded({ extended: false})

mongoose.connect('mongodb://localhost/users', { useNewUrlParser: true, useUnifiedTopology: true});

mongoose.Promise = global.Promise

app.get('/root', (req, res) => {
    res.sendFile(path.join(__dirname + '/html/index.html'))
})

app.post('/root/login', urlparser, (req, res) => {
    var email = req.body.email
    var password = req.body.password
    console.log(email, password)
    //var userSearch = User.findOne({email: email, password: password}).exec()
    //console.log(userSearch)
    res.sendFile(path.join(__dirname + '/html/home.html'))
    //res.sendFile(path.join(__dirname + '/html/home.html'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
