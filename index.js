const express = require('express')
const ejs = require('ejs')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
//const { allowedNodeEnvironmentFlags } = require('process')
var urlparser = bodyParser.urlencoded({ extended: false })
let userExists
let emailExists

app.set('view engine', 'ejs')

mongoose.Promise = global.Promise
mongoose.connect('mongodb://localhost/users', { useNewUrlParser: true, useUnifiedTopology: true})
    .then(res => console.log("Connected to MongoDB"))
    .catch(err => console.log("INITERROR:", err))

mongoose.connection.once('open', function(){
    console.log("Connection made")
}).on('error', function(error){
    console.log("CONNECTIONERR: ", error)
})

app.get('/root', (req, res) => {
    res.render('pages/index')
})

app.post('/root/login', urlparser, (req, res) => {
    var email = req.body.email
    var password = req.body.password
    console.log(email, password)
    User.findOne({email: email, password: password}, 'username', function(err, person){
        if(err){
            console.log("ERROR: ", err);
            return;
        }else{
            if(person == null){ //Person not found
                console.log('Person not found');
                res.render('pages/loginRedirect', {message:"Incorrect username/password"})
                return;
            }
            global.username = person.username;
            console.log("Welcome,", global.username);
            res.render('pages/onLogin',{name:global.username})
        }
    });
    //console.log(userSearch)
    //res.sendFile(path.join(__dirname + '/html/home.html'))
})

app.post('/root/register', urlparser, (req, res) => {
    var username = req.body.username
    var email = req.body.email
    var password = req.body.password
    console.log(username, email, password)

    userExists = false
    emailExists = false

    User.find({username: username}, function(err, docs) {
        if(docs.length > 0){ //Is there a user
            console.log(docs.length)
            userExists = true
        }
    })

    User.find({email: email}, function(err, docs) {
        if(docs.length > 0){ //Is there an email
            console.log(docs.length)
            emailExists = true
        }
    })

    console.log(emailExists, userExists)

    if(global.userExists){
        res.render('pages/registerRedirect', {message:"Username already exists, try entering another name."})
    }else if(global.emailExists){
        res.render('pages/registerRedirect', {message:"Email already exists, try entering another name."})
    }else{
        User.create({username:username,email:email,password:password})
        console.log('User created')
        res.render('pages/onRegister', {name: username})
    }
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
