<<<<<<< HEAD
const express = require('express');
const path = require('path');
var bodyParser  = require('body-parser');
const app = express();


app.use(bodyParser.json());
var urlEncodedParser = bodyParser.urlencoded({extended: false});
=======
const express = require('express')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
var urlparser = bodyParser.urlencoded({ extended: false})
>>>>>>> 005fbc3ff962ff3a409412a91f6703cedc213018

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

app.post('/login', urlEncodedParser, (req, res) => {
    res.sendFile(path.join(__dirname + '/html/onLogin.html'));
    console.log(req.body.email);
    console.log(req.body.password);
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
