const express = require('express')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
//const { allowedNodeEnvironmentFlags } = require('process')
var urlparser = bodyParser.urlencoded({ extended: false})

mongoose.Promise = global.Promise
mongoose.connect('mongodb://localhost/users', { useNewUrlParser: true, useUnifiedTopology: true})
    .then(res => console.log("Connected to MongoDB"))
    .catch(err => console.log("INITERROR:", err))

mongoose.connection.once('open', function(){
    console.log("Connection made")
}).on('error', function(error){
    console.log("CONNECTIONERR: ", err)
})

app.get('/root', (req, res) => {
    res.sendFile(path.join(__dirname + '/html/index.html'))
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
                return;
            }
            console.log("Welcome,", person.username);
        }
    });
    //console.log(userSearch)
    res.sendFile(path.join(__dirname + '/html/onLogin.html'))
    //res.sendFile(path.join(__dirname + '/html/home.html'))
})

app.post('/root/register', urlparser, (req, res) => {
    var username = req.body.username
    var email = req.body.email
    var password = req.body.password
    console.log(username, email, password)
    User.create({username:username,email:email,password:password})
    console.log('User created')
    //var userSearch = User.findOne({email: email, password: password}).exec()
    //console.log(userSearch)
    res.sendFile(path.join(__dirname + '/html/onRegister.html'))
})


app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
