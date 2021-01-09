const express = require('express')
fileUpload = require('express-fileupload') //Allows us to upload files
const ejs = require('ejs')
const https = require('axios').default //Library for sending get/post requests
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
const User = require('./models/user.js')
const Image = require('./models/image.js')
//const { MongoClient } = require('mongodb') Don't really need this library
const nodeWebcam = require('node-webcam'); //To-Do
//const { default: Axios } = require('axios')



if(!process.env.CLOUDINARY_URL){ process.env.CLOUDINARY_URL = 'cloudinary://487694253654926:VXZoC5K95NmpMjZUteZEfsVOhog@gardenx'} //DELETE THIS AFTER WE DON'T NEED TO TEST LOCALLY
if(!process.env.PLANT_API_KEY){ process.env.PLANT_API_KEY = '2a10x2BPqelys3D5QttaEmNwO'} //DELETE THIS TOO
var cloudinary = require('cloudinary').v2
//const { prependListener } = require('./models/user.js')


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
mongoose.connect(mongoUrl, {useNewUrlParser:true,useUnifiedTopology:true, useFindAndModify:false}); //Connect to MongoDB Atlas

function idToUsername(id){
    return User.findById(id).then(function(err, response){return response.username})
}

function identifyPlant(url){ //Using Pl@ntnet for the API, trefle didn't have any image recognition. This has 50 free requests per day.
    apiLink = 'https://my-api.plantnet.org/v2/identify/all'
    //TODO: Send a GET request to apiLink and parse the result, more at https://my.plantnet.org/usage
    console.log(url)
    
    return https.get(apiLink, {
        params:{
            'api-key':process.env.PLANT_API_KEY,
            'images': encodeURI(url), //encodeURI turns stuff like :// into URL-readable format ex. %3A%2F%2F
            'organs':'leaf'
        }
        })
        .then(function (response) {
            plantSpecies = response.data.results;
            statusCode = response.data.statusCode;
            if(statusCode != undefined)
            if(plantSpecies.length == 0){return}
            mostLikelySpecies = plantSpecies[0]; //For now, only looking at most likely guessed by AI but this could change later
            accuracy = Math.floor(parseFloat(mostLikelySpecies['score']) * 100) //Makes this a number then rounds
            plantData = mostLikelySpecies['species']
            scientificName = plantData['scientificNameWithoutAuthor']
            author = plantData['scientificNameAuthorship']
            if(author=="L."){ author = "Carl Linnaeus"}
            genus = plantData['genus']['scientificNameWithoutAuthor'] //Genus and family also have author data, but we don't necessarily want that here.
            family = plantData['family']['scientificNameWithoutAuthor']
            commonNames = plantData['commonNames']
            console.log(mostLikelySpecies['score'])
            commonNamesJoined = commonNames.join(', ') //commonNames is an array, so we want to convert into a string
            plantArgs = {message:'Your plant has been processed!', resultImage: uploadedImage, plantName: scientificName, commonName:commonNamesJoined, author:author, genus:genus, family:family, accuracy:accuracy} //We render in the original function
            Image.create({plantName:scientificName,
                        commonName: commonNamesJoined,
                        foundBy:author,
                        genus: genus,
                        family: family,
                        accuracy: accuracy,
                        user: global.id,
                        url:url})
                .then(function(response){
                    console.log("Image Created")
                })
                .catch(function(err){
                    console.error(err)
                })
            return plantArgs

        })
        .catch(function (error) {
        console.log(error);
        });
}


app.get('/root', (req, res) => { //Main page
    if(global.id == null){res.render('pages/index')
    }else{
        res.render('pages/onLogin', {name:global.username, joined:global.dateJoined})
    }
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
                global.dateJoined = person.joinDate
                console.log("Welcome,", global.username);
                global.imagePublic = person.imagePublic;
                res.render('pages/onLogin',{name:global.username, joined:global.dateJoined}) //Logged in, now we show the login page
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
        .then(function(res){
            console.log('User created')
        })
        .catch(function(err){
            console.error(err)
        })
    res.redirect('/root')
    global.imagePublic = true
    }
)

app.get('/root/uploadPicture', urlparser, (req, res) => {
    res.render('pages/takePicture', {message:''})
})

app.post('/root/uploadPicture', urlparser, (req, res) => {
    if(!req.files || Object.keys(req.files).length === 0){
        res.render('pages/takePicture', {message:'No picture uploaded', resultImage:''}) //Shouldn't be called due to required HTML input, but it's here in case
        return
    }

    if(!global.id){
        global.id = 'anonymous'
        console.log("NOTE: User is not logged in, picture will be uploaded to an anonymous folder") 
    }

    let image = req.files.image;

    //Save image to the cloud(currently using cloudinary) as we can't use heroku for storage
    userFolder = 'images/' + global.id + '/'//The folder for all the user's images
    filePath = image.tempFilePath
    cloudinary.uploader.upload(filePath, { folder: userFolder}, function(err, result){ 
        console.log(err, result) //Result includes a public ID we can use
        uploadedImage = cloudinary.image(result.public_id, { format:"jpg", crop:"fill", phash:true}) //Using cloudinary instead of the local image to make images more uniform
        cloudinary.search //Getting rid of possible duplicate
            .expression('folder:images/' + global.id)
            .execute().then(result=>{
                result['resources'].forEach(pic => {
                    if(pic['resource_type'] == 'image'){ //Is an image?
                        console.log(pic)
                    }
                })
            })
        uploadedImageUrl = result.secure_url
        let plantInfo = identifyPlant(uploadedImageUrl)
        if(plantInfo == null){
            console.log("No plant species found")
            res.render('pages/takePicture', {message:'No species found'})
            return
        }
        plantInfo.then(function(info){
            console.log(info)
            res.render('pages/plantResult', info)
        })

    })
})

app.get('/root/myGarden', urlparser, (req, res) => {
    if(!global.id){
        //global.id = 'anonymous'
        res.render('pages/loginRedirect', {message: "Please login to see your garden"})
        return
    }
    console.log(global.id)
    Image.find({user:global.id}, function(err, images){
    
        if(err){
            console.error("ERROR: ", err);
            return
        }else{
            imagesString = ``
            lowAccuracyPrompt = "If this number is low, please try taking the picture in different lighting, adjusting the angle of the picture so the plant is clearly visible, or making sure the plant is detailed and clearly visible."
            console.log(images)
            images.forEach(image =>{
                console.log(image.public_id)
                imageCard = `
                <div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                    <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                    <div class="card-body">
                        <a href="/root/posts/${image._id}"><h5 class="card-title">${global.username}'s ${image.plantName}</h1></a>
                        <h6 class="card-subtitle">Also known as ${image.commonName}</h2>
                        <p class="card-text">Named by ${image.foundBy}</h2>
                        <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                        <span tabindex="0" data-toggle="tooltip" data-placement="bottom" title="${lowAccuracyPrompt}"
                            <p class='text-muted'>${image.accuracy}% accurate.</p>
                        </span>
                    </div>
                </div>
                `
                imagesString += imageCard
            })
            res.render('pages/myGarden', {images:imagesString})
            
        } 
        })
})

app.get('/root/posts/*', function(req, res){
    postId = req.originalUrl.replace("/root/posts/", "")
    Image.countDocuments({_id:postId}, function(err,result){
        if(err){
            console.error(err)
        }else{
            if(result>0){ //If image exists?
                Image.findById(postId, function(err, image){
                    imageCard = `
                    <div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                        <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                        <div class="card-body">
                            <h5 class="card-title">Also known as ${image.commonName}</h2>
                            <p class="card-text">Named by ${image.foundBy}</h2>
                            <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                        </div>
                    </div>
                    `
                    linkMeta = `
                    <meta property="og:title" content="GardenX" />
                    <meta property="og:type" content="website" />
                    <meta property="og:url" content="https://gardenx.herokuapp.com" />
                    <meta property="og:image" content="${image.url}" />
                    <meta property="og:description" content="Find the ${image.plantName} and more plants on GardenX." />
                    <meta name="theme-color" content="#FF0000">
                    `

                    User.findById(image.user, function(err, user){
                        if(err){
                            console.error(err)
                            return
                        }
                        if(user.imagePublic){
                            res.render('pages/public/post', {username: user.username, plantName:image.plantName,card:imageCard, linkPreview:linkMeta})
                        }else{
                            res.render('pages/public/404')
                        }
                    })
                })
            }else{
                res.render('pages/public/404')
            }
        }
    })
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
