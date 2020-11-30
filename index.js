const express = require('express')
fileUpload = require('express-fileupload') //Allows us to upload files
const ejs = require('ejs')
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
//const { MongoClient } = require('mongodb') Don't really need this library
const nodeWebcam = require('node-webcam'); //To-Do



if(!process.env.CLOUDINARY_URL){ process.env.CLOUDINARY_URL = 'cloudinary://487694253654926:VXZoC5K95NmpMjZUteZEfsVOhog@gardenx'} //DELETE THIS AFTER WE DON'T NEED TO TEST LOCALLY
var cloudinary = require('cloudinary').v2


var urlparser = bodyParser.urlencoded({ extended: false })
let userExists
let emailExists

var pictureOptions = {
    width: 1280,
    height: 720, 
    quality: 100,
    delay: 1,
    saveShots: true,
    output: "jpeg",
    device: false,
    callbackReturn: "location"
};

app.use('/images', express.static(path.join(__dirname, 'images'))) //First comment "shares" the images directory publicly, this lets us see the images later and can help us pass images to plant API
app.use(fileUpload({useTempFiles:true})) //Integrates file Upload library

var webcam = nodeWebcam.create(pictureOptions)

app.set('view engine', 'ejs')

if(process.env.MONGODB_URI){ mongoUrl = process.env.MONGODB_URI}
mongoUrl = "mongodb+srv://hrishi:rgPrelhUhhO7RS8x@cluster0.dss66.mongodb.net/GardenX?retryWrites=true&w=majority" //MongoDB Atlas connection URL
mongoose.connect(mongoUrl, {useNewUrlParser:true,useUnifiedTopology:true}); //Connect to MongoDB Atlas


app.get('/root', (req, res) => {
    res.render('pages/index')
})

app.post('/root/login', urlparser, (req, res) => { //Login function
    var email = req.body.email
    var password = req.body.password
    console.log(email, password)
    try{
        User.findOne({email: email, password: password}, function(err, person){ 
        //User.findOneAndRemove({email: email, password: password}, function(err, person){
            if(err){
                console.log("ERROR: ", err);
                return;
            }else{
                if(person == null){ //Person not found
                    console.log('Person not found');
                    res.render('pages/loginRedirect', {message:"Incorrect username/password"})
                    return
                }
                global.username = person.username;
                global.id = person._id.toString()
                console.log(id)
                dateJoined = person.joinDate
                console.log("Welcome,", global.username);
                res.render('pages/onLogin',{name:global.username, joined:dateJoined}) //Logged in, now we show the login page
            }
        });
    } catch {
        //Account not found, incorrect email/password most likely
        res.render('pages/onLogin',{message:"Incorrect password"})
    }
})

app.post('/root/register', urlparser, (req, res) => {
    var username = req.body.username
    var email = req.body.email
    var password = req.body.password
    console.log(username, email, password)


    //Note: these two checks currently do nothing
    User.find({username: username}, function(err, docs) {
        if(docs.length > 0){ //Is there a user
            console.log(docs.length)
        }
    })

    User.find({email: email}, function(err, docs) {
        if(docs.length > 0){ //Is there an email
            console.log(docs.length)
        }
    })

    console.log(emailExists, userExists)

    //if(userExists){ NOTE: Add duplication check later
    //    res.render('pages/registerRedirect', {message:"Username already exists, try entering another name."})
    //}else if(emailExists){
    //    res.render('pages/registerRedirect', {message:"Email already exists, try entering another name."})
    //}else{
    User.create({username:username,email:email,password:password,joinDate:(new Date()).toLocaleDateString()}) //Create a new user, the date is just an example of other attributes that can be added
    console.log('User created')
    res.render('pages/onRegister', {name: username})
    }
)

app.get('/root/uploadPicture', urlparser, (req, res) => {
    res.render('pages/takePicture', {message:''})
})

app.post('/root/uploadPicture', urlparser, (req, res) => {
    if(!req.files || Object.keys(req.files).length === 0){
        res.render('pages/takePicture', {message:'No picture uploaded'})
        return
    }

    if(!global.id){global.id = 'anonymous'}

    let image = req.files.image;

    //Save image to the cloud(currently using cloudinary) as we can't use heroku for storage
    userFolder = global.id + '/'//The folder for all the user's images
    console.log(path.join(__dirname, '/images/') + fileId)
    filePath = image.tempFilePath
    cloudinary.uploader.upload(filePath, { folder: userFolder}, function(err, res){ 
        console.log(err, res) //Result includes a public ID we can use
        uploadedImage = cloudinary.image(res.public_id, { format:"jpg", crop:"fill"}) //Using cloudinary instead of the local image to make images more uniform
        res.render('pages/takePicture', {message:'Picture saved!', resultImage: uploadedImage})

    })
})


app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
