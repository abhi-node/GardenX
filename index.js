require('dotenv').config()

const express = require('express')
fileUpload = require('express-fileupload') //Allows us to upload files
const ejs = require('ejs')
const https = require('axios').default //Library for sending get/post requests
const path = require('path')
const app = express()
const bodyParser = require('body-parser')
const mongoose = require('mongoose')

const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')

const User = require('./models/user.js')
const Image = require('./models/image.js')


var cloudinary = require('cloudinary').v2


var urlparser = bodyParser.urlencoded({ extended: false })
app.use(cookieParser(process.env.COOKIE_SIGNED_SECRET))

app.use('/static', express.static(path.join(__dirname, 'views/static'))) //First comment "shares" the images directory publicly, this lets us see the images later and can help us pass images to plant API
app.use(fileUpload({useTempFiles:true})) //Integrates file Upload library

app.set('view engine', 'ejs')
mongoose.connect(process.env.MONGO_URL, {useNewUrlParser:true,useUnifiedTopology:true, useFindAndModify:false,useCreateIndex:true}); //Connect to MongoDB Atlas

async function isImageLiked(image, username){
    likes = image.likes
    if(image.user === username){ return "user"}
    else if(likes.includes(username)){ return true}
    else{return false}
}

function authToken(req, res, next){
    const token = req.signedCookies.jwt
    if(token === undefined||token==null){ return res.redirect('/root/login')}

    jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, user)=>{
        if(err){return res.render('pages/login.ejs', {message:"Please log in."})}
        req.user = user
        next()
    })
}

async function getUserPlantsLikes(user){
    userLikes = 0
    plants = await Image.find({user:user.username})
    plants.forEach(function(plant){
        userLikes += plant.likes.length - 0
    })
    numPlants = plants.length
    if(numPlants==0 || numPlants == null) numPlants = "No"
    if(userLikes==0) userLikes = "No"
    else userLikes = userLikes.toString()+" total"
    return [numPlants, userLikes]
}

function identifyPlant(url, id){ //Using Pl@ntnet for the API, trefle didn't have any image recognition. This has 50 free requests per day.
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
            author.replace("L.", "Carl Linnaeus")
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
                        user: id,
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

app.get('/root/logout', (req, res)=>{
    res.clearCookie('jwt')
    res.redirect('/root')
})

app.get('/root', authToken, (req, res) => { //Main page
    res.render('pages/onLogin', {name:req.user.name})
})

app.get('/root/login', urlparser, (req, res)=>{
    res.render('pages/login')
})
app.get('/root/register', urlparser, (req, res)=>{
    res.render('pages/register')
})

app.post('/login', urlparser, (req, res) => { //Login function
    var email = req.body.email
    var password = req.body.password
    try{
        User.findOne({email: email}, function(err, person){ 
        //User.findOneAndRemove({email: email, password: password}, function(err, person){
            if(err){
                console.log("ERROR: ", err);
                return;
            }else{
                if(person == null){ //Person not found
                    res.render('pages/login', {message:"Incorrect email"})
                    return
                }
                bcrypt.compare(req.body.password, person.password, function(err, result){
                    if(result == true){
                        //Correct credentials, log in
                        const accessToken = jwt.sign({name:person.username, id:person.id}, process.env.SECRET_ACCESS_TOKEN)
                        res.cookie('jwt',accessToken, {maxAge: 3600000,signed:true,httpOnly:true})
                        res.redirect('/root') //Logged in, now we show the login page
                    }else{
                        res.render('pages/loginRedirect', {message:"Incorrect password"})
                    }
                })
            }})
    } catch {
        //Account not found, incorrect email/password most likely
        res.render('pages/onLogin',{message:"Incorrect email/password"})
    }
})

app.post('/root/register', urlparser, async (req, res) => {
    hashedSaltedPass = await bcrypt.hash(req.body.password, 15)
    username = req.body.username
    email = req.body.email
    try{
        newUser = await User.create({username:username,email:email,password:hashedSaltedPass,joinDate:(new Date()).toLocaleDateString()}) //Create a new user, the date is just an example of other attributes that can be added
        
        const accessToken = jwt.sign({name:username,id:newUser.id}, process.env.SECRET_ACCESS_TOKEN)
        res.clearCookie('jwt')
        res.cookie('jwt',accessToken, {maxAge: 3600000,signed:true,httpOnly:true})
    }catch(err){
        if(err.errors.username && err.errors.username.kind == "unique"){ return res.render('pages/registerRedirect.ejs', {message: "Username already taken. Please choose a different one."})}
        if(err.errors.email && err.errors.email.kind == "unique"){ return res.render('pages/registerRedirect.ejs', {message: "Email already taken. Please choose a different one."})}
    }
    res.redirect('/root')
    }
)

app.get('/root/uploadPicture', authToken, urlparser, (req, res) => {
    res.render('pages/takePicture', {message:''})
})

app.post('/root/uploadPicture', authToken, urlparser, (req, res) => {
    if(!req.files || Object.keys(req.files).length === 0){
        res.render('pages/takePicture', {message:'No picture uploaded', resultImage:''}) //Shouldn't be called due to required HTML input, but it's here in case
        return
    }

    let image = req.files.image;

    //Save image to the cloud(currently using cloudinary) as we can't use heroku for storage
    userFolder = 'images/' + req.user.id + '/'//The folder for all the user's images
    filePath = image.tempFilePath
    cloudinary.uploader.upload(filePath, { folder: userFolder}, function(err, result){ 
        console.log(err, result) //Result includes a public ID we can use
        uploadedImage = cloudinary.image(result.public_id, { format:"jpg", crop:"fill", phash:true}) //Using cloudinary instead of the local image to make images more uniform
        cloudinary.search //Getting rid of possible duplicate
            .expression('folder:images/' + req.user.id)
            .execute().then(result=>{
                result['resources'].forEach(pic => {
                    if(pic['resource_type'] == 'image'){ //Is an image?
                        console.log(pic)
                    }
                })
            })
        uploadedImageUrl = result.secure_url
        let plantInfo = identifyPlant(uploadedImageUrl, req.user.name)
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

app.get('/root/myGarden', authToken, urlparser, async function(req, res){
    console.log(req.user.id)
    images = await Image.find({user:req.user.name})
    imagesString = ``
    lowAccuracyPrompt = "If this number is low, please try taking the picture in different lighting, adjusting the angle of the picture so the plant is clearly visible, or making sure the plant is detailed and clearly visible."
    images.forEach(function(image){

        imageCard = `<div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
            <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
            <div class="card-body">
                <a href="/root/posts/${image._id}"><h5 class="card-title">${req.user.name}'s ${image.plantName}</h1></a>
                <h6 class="card-subtitle">Also known as ${image.commonName}</h2>
                <p class="card-text">Named by ${image.foundBy}</h2>
                <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                <span tabindex="0" data-toggle="tooltip" data-placement="bottom" title="${lowAccuracyPrompt}">
                    <p class='text-muted'>${image.accuracy}% accurate.</p>
                </span>
                <button class="btn btn-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>
            </div>
        </div>
        `

        imagesString += imageCard
    })
    res.render('pages/myGarden', {images:imagesString})
})

app.get('/root/posts/*', authToken, function(req, res){
    postId = req.originalUrl.replace("/root/posts/", "")
    Image.countDocuments({_id:postId}, async function(err,result){
        if(err){
            console.error(err)
        }else{
            if(result>0){ //If image exists?
                Image.findById(postId, async function(err, image){
                    likeButton = ``
                    likeResult = await isImageLiked(image, req.user.name)
                    if(likeResult===true) likeButton = `<a href="/root/like/${image._id}?user=${username}" title="Liked"><button class="btn btn-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                    else if(likeResult==="user") likeButton = `<button class="btn btn-outline-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>`
                    else likeButton = `<a href="/root/like/${image._id}?user=${username}"><button class="btn btn-outline-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                    imageCard = `
                    <div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                        <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                        <div class="card-body">
                            <h5 class="card-title">Also known as ${image.commonName}</h2>
                            <p class="card-text">Named by ${image.foundBy}</h2>
                            <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                            ${likeButton}
                        </div>
                        <span tabindex="0">
                            <p class='text-muted'>${image.accuracy}% accurate.</p>
                        </span>
                    </div>
                    `

                    User.findOne({username:image.user}, function(err, user){
                        if(err){
                            console.error(err)
                            return
                        }

                        linkMeta = `
                        <meta property="og:title" content="GardenX" />
                        <meta property="og:type" content="website" />
                        <meta property="og:url" content="https://gardenx.herokuapp.com" />
                        <meta property="og:image" content="${image.url}" />
                        <meta property="og:description" content="Find ${user.username}'s ${image.plantName} and more on GardenX." />
                        <meta name="theme-color" content="#FF0000">
                        `

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

app.get('/root/user/*', authToken, async function(req, res){
    username = req.originalUrl.replace("/root/user/", "")
    images = await Image.find({user:username})
    imagesString = ``
    images.forEach(async function(image){
        likeButton = ``
        likeResult = await isImageLiked(image, req.user.name)
        if(likeResult===true) likeButton = `<a href="/root/like/${image._id}?user=${username}" title="Liked"><button class="btn btn-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
        else if(likeResult==="user") likeButton = `<button class="btn btn-outline-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>`
        else likeButton = `<a href="/root/like/${image._id}?user=${username}"><button class="btn btn-outline-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
        imageCard = `
            <div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                <div class="card-body">
                    <a href="/root/posts/${image._id}"><h5 class="card-title">${image.plantName}</h1></a>
                    <h6 class="card-subtitle">Also known as ${image.commonName}</h2>
                    <p class="card-text">Named by ${image.foundBy}</h2>
                    <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                    ${likeButton}
                </div>
                <span>
                    <p class='text-muted'>${image.accuracy}% accurate.</p>
                </span>
            </div>
            `
        imagesString += imageCard
    })
    user = await User.findOne({username:username})

    linkMeta = `
    <meta property="og:title" content="GardenX" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://gardenx.herokuapp.com" />
    <meta property="og:description" content="Find ${user.username}'s garden and others on GardenX." />
    <meta name="theme-color" content="#FF0000">
    `

    if(user.imagePublic){
        res.render('pages/public/user', {username:username,images:imagesString, linkPreview:linkMeta})
    }else{
        res.render('pages/public/404')
    }
})
function prevURL(req){
    if(req.query.post){ return `/root/posts/${req.query.post}`}
    else if(req.query.user){ return `/root/user/${req.query.user}`}
    else{return 'back'}
}



app.get('/root/like/*', authToken, async function(req,res){
    likedImgId = req.originalUrl.replace('/root/like/', "")
    likedImgId = likedImgId.split('?')[0]
    likedImage = await Image.findById(likedImgId)
    isLiked = await isImageLiked(likedImage, req.user.name)
    if(isLiked==true){
        //Already liked, remove like
        likedImage.likes.pull(req.user.name)
        likedImage.save()
    }
    else if(isLiked==="user"){return res.redirect(await prevURL(req))} //Person liking image = author, decline
    else{
        //Not yet liked, add one
        likedImage.likes.push(req.user.name)
        likedImage.save()
    }
    res.redirect(await prevURL(req))
})

app.get('/root/search', authToken, async function(req, res){
    cardStr = ``
    if(!req.query.search){return res.redirect('/root')}
    search = new RegExp(req.query.search, 'i')
    results = await Image.find({$text:{$search:search}})
    users = await User.find({username:search})
    console.log(results,users)
    if(results == null && users == null){
        console.log('a')
        return res.render('pages/search')}
    else{
        if(users!=null){
            cardStr += `
            <h3>Users</h3>
            <div class="card-deck" style="width:70%;padding-left:5%;padding-top:5%">`
            for(const user of users){
                stats = await getUserPlantsLikes(user)
                userCard = `
                <div class="card" style="width: 1%;">
                    <div class="card-body">
                        <h5 class="card-title">${user.username}</h5>
                        <p class="card-text">${stats[0]} plants</p>
                        <p class="card-text">${stats[1]} likes</p>
                        <a href="/root/user/${user.username}" class="card-link">View Profile</a>
                    </div>
                </div>
                `
                cardStr += userCard
            }
            cardStr +='</div><br/>'
        }
        if(results != null){
            cardStr += `
            <h3>Plants</h3>
            <div class="card-deck" style="padding-left:5%;padding-top:5%">`
            for(const image of results){
                poster = await User.findOne({username:image.user})
                if(!poster.imagePublic){continue}
                likeButton = ``
                likeResult = await isImageLiked(image, req.user.name)
                if(likeResult===true) likeButton = `<a href="/root/like/${image._id}" title="Liked"><button class="btn btn-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                else if(likeResult==="user") likeButton = `<button class="btn btn-outline-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>`
                else likeButton = `<a href="/root/like/${image._id}"><button class="btn btn-outline-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                imageStr = `
                <div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                    <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                    <div class="card-body">
                        <a href="/root/posts/${image._id}"><h5 class="card-title">${image.user}'s ${image.plantName}</h1></a>
                        <h6 class="card-subtitle">Also known as ${image.commonName}</h2>
                        <p class="card-text">Named by ${image.foundBy}</h2>
                        <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                        ${likeButton}
                    </div>
                    <span>
                        <p class='text-muted'>${image.accuracy}% accurate.</p>
                    </span>
                </div>
                `
                cardStr += imageStr
            }
            cardStr += `</div>`
        }
    }
    res.render("pages/search",{search:req.query.search,results:cardStr})   
})

//Keep every other route above this
app.get('*', function(req, res) {
    res.redirect('/root');
});

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})