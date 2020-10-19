const express = require('express')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const User = require('./models/user.js')
var urlparser = bodyParser.urlencoded({ extended: false})

app.get('/root', (req, res) => {
    res.sendFile(path.join(__dirname + '/html/index.html'))
})

app.post('/root/login', urlparser, (req, res) => {
    User.create(req.body)
    res.sendFile(path.join(__dirname + '/html/home.html'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
