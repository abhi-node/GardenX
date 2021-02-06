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
const Notif = require('./models/notification.js')

const {formatDistance, parseISO} = require('date-fns')

var cloudinary = require('cloudinary').v2
const { request } = require('http')


var urlparser = bodyParser.urlencoded({ extended: false })
app.use(cookieParser(process.env.COOKIE_SIGNED_SECRET))

app.use('/static', express.static(path.join(__dirname, 'views/static'))) //First comment "shares" the images directory publicly, this lets us see the images later and can help us pass images to plant API
app.use(fileUpload({useTempFiles:true})) //Integrates file Upload library

app.set('view engine', 'ejs')
mongoose.connect(process.env.MONGO_URL, {useNewUrlParser:true,useUnifiedTopology:true, useFindAndModify:false,useCreateIndex:true}); //Connect to MongoDB Atlas

function prevURL(req){
    if(req.query.post){ return `/root/posts/${req.query.post}`}
    else if(req.query.user){ return `/root/user/${req.query.user}`}
    else{return 'back'}
}

const pluralize = (count, noun) =>{
    //console.log(count)
    if(count == 0){return 'No ' + noun +'s'}
    else if(count == 1){return '1 ' + noun}
    else{return count.toString() + ' ' + noun+'s'}
}

async function isImageLiked(image, username){
    likes = image.likes
    if(image.user === username){ return "user"}
    else if(likes.includes(username)){ return true}
    else{return false}
}

async function checkNotifs(req,res,next){
    notifs = await Notif.find({receivers:req.user.name})
    if(notifs == []){return next()}
    messages = []
    notifs.forEach(async function(notif){
        type = ""
        if(notif.type=="friend"){type = "Friend Request"}
        else if(notif.type=="unfriend"){type = "Unfriended"}
        else if(notif.type=="post"){type = "New Post"}
        date = formatDistance(notif.sent, new Date())
        messages.push({"title":type,"date":date,"msg":notif.msg,"img":notif.image})
        //We've saved notif, delete the mongodb
        await Notif.deleteOne(notif)
    })

    res.locals.notifs = messages
    next()
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
    else userLikes = userLikes.toString()
    return [numPlants, userLikes]
}

async function identifyPlant(url, id){ //Using Pl@ntnet for the API, trefle didn't have any image recognition. This has 50 free requests per day.
    apiLink = 'https://my-api.plantnet.org/v2/identify/all'
    //console.log(url)
    
    return https.get(apiLink, {
        params:{
            'api-key':process.env.PLANT_API_KEY,
            'images': encodeURI(url), //encodeURI turns stuff like :// into URL-readable format ex. %3A%2F%2F
            'organs':'leaf'
        }
        })
        .then(async function (response) {
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
            //console.log(mostLikelySpecies['score'])
            commonNamesJoined = commonNames.join(', ') //commonNames is an array, so we want to convert into a string
            plantArgs = {message:'Your plant has been processed!', resultImage: uploadedImage, plantName: scientificName, commonName:commonNamesJoined, author:author, genus:genus, family:family, accuracy:accuracy} //We render in the original function
            img = await Image.create({plantName:scientificName,
                        commonName: commonNamesJoined,
                        foundBy:author,
                        genus: genus,
                        family: family,
                        accuracy: accuracy,
                        user: id,
                        url:url})
            plantArgs.doc = img
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

app.get('/root', authToken, checkNotifs, (req, res) => { //Main page
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
                        res.render('pages/login', {message:"Incorrect password"})
                    }
                })
            }})
    } catch {
        //Account not found, incorrect email/password most likely
        res.render('pages/login',{message:"Incorrect email/password"})
    }
})

app.post('/root/register', urlparser, async (req, res) => {
    hashedSaltedPass = await bcrypt.hash(req.body.password, 15)
    username = req.body.username
    email = req.body.email
    try{
        newUser = await User.create({username:username,email:email,password:hashedSaltedPass,joinDate:(new Date()).toLocaleDateString()}) //Create a new user, the date is just an example of other attributes that can be added
        
        
    }catch(err){
        if(err.errors.username && err.errors.username.kind == "unique"){ return res.render('pages/registerRedirect.ejs', {message: "Username already taken. Please choose a different one."})}
        if(err.errors.email && err.errors.email.kind == "unique"){ return res.render('pages/registerRedirect.ejs', {message: "Email already taken. Please choose a different one."})}
    }
    const accessToken = jwt.sign({name:username,id:newUser.id}, process.env.SECRET_ACCESS_TOKEN)
    await res.clearCookie('jwt')
    await res.cookie('jwt',accessToken, {maxAge: 3600000,signed:true,httpOnly:true})
    res.redirect('/root')
    }
)

app.get('/root/uploadPicture', authToken, checkNotifs, urlparser, (req, res) => {
    res.render('pages/takePicture', {message:''})
})

app.post('/root/uploadPicture', authToken, checkNotifs, urlparser, (req, res) => {
    if(!req.files || Object.keys(req.files).length === 0){
        res.render('pages/takePicture', {message:'No picture uploaded', resultImage:''}) //Shouldn't be called due to required HTML input, but it's here in case
        return
    }

    let image = req.files.image;

    //Save image to the cloud(currently using cloudinary) as we can't use heroku for storage
    userFolder = 'images/' + req.user.id + '/'//The folder for all the user's images
    filePath = image.tempFilePath
    cloudinary.uploader.upload(filePath, { folder: userFolder}, async function(err, result){ 
        //console.log(err, result) //Result includes a public ID we can use
        uploadedImage = cloudinary.image(result.public_id, { format:"jpg", crop:"fill", phash:true}) //Using cloudinary instead of the local image to make images more uniform
        uploadedImageUrl = result.secure_url
        let plantInfo = identifyPlant(uploadedImageUrl, req.user.name)
        if(plantInfo == null){
            return res.render('pages/takePicture', {message:'No species found'})
        }else{
        plantInfo.then(async function(info){
            plantDoc = info.doc
            cUser = await User.findOne({username:req.user.name})
            await Notif.create({type:"post",sender:req.user.name, receivers:cUser.friends,msg:`<p>${req.user.name} posted a new ${plantDoc.plantName}. Find it <a href="/root/posts/${plantDoc._id}">here</a>.</p>`,image:uploadedImageUrl})
            res.render('pages/plantResult', info)
        })}

    })
})

app.get('/root/myGarden', authToken, checkNotifs, urlparser, async function(req, res){
    images = await Image.find({user:req.user.name})
    imagesString = ``
    lowAccuracyPrompt = "If this number is low, please try taking the picture in different lighting, adjusting the angle of the picture so the plant is clearly visible, or making sure the plant is detailed and clearly visible."
    if(images.length == 0){
        return res.render('pages/myGarden',{images:`<h4 style="width:100%;">You haven't uploaded any plants yet.</h4><hr/><p>Upload some <a href="/root/uploadPicture"> here</a>.</p>`})
    }
    images.forEach(function(image){

        imageCard = `<div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
            <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
            <div class="card-body">
                <a href="/root/posts/${image._id}"><h5 class="card-title">${req.user.name}'s ${image.plantName}</h1></a>
                <h6 class="card-subtitle">Also known as ${image.commonName}</h2>
                <p class="card-text">Named by ${image.foundBy}</h2>
                <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                <span tabindex="0" data-bs-toggle="tooltip" data-placement="bottom" title="${lowAccuracyPrompt}">
                    <p class='text-muted'>${image.accuracy}% accurate.</p>
                </span>
                <div style="width:100%;text-align:center;">
                    <button class="btn btn-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>
                    <button class="btn btn-secondary" data-href="/root/remove/${image._id}" style="display:inline-block; margin-left:5%;" data-bs-toggle="modal" data-bs-target="#deleteModal"><i class="bi bi-trash"></i></button>
                </div>
            </div>
        </div>
        `

        imagesString += imageCard
    })
    res.render('pages/myGarden', {images:imagesString})
})

app.get('/root/friends', authToken, checkNotifs, async function(req,res){
    incReqs = []
    incUsers = await User.find({requests:req.user.name})
    incUsers.forEach(function(user){
        incReqs.push({"user":user.username})
    })
    
    friends = []
    cUser = await User.findOne({username:req.user.name})
    for(const user of cUser.friends){
        friend = await User.findOne({username:user})
        stats = await getUserPlantsLikes(friend)
        friends.push({"username":user,"stats":stats})
    }

    outReqs = []
    for(const user of cUser.requests){
        outReq = await User.findOne({username:user})
        if(outReq==null){continue}
        stats = await getUserPlantsLikes(outReq)
        outReqs.push({"username":user,"stats":stats})
    }

    res.render('pages/friends', {requests:incReqs,friends:friends, outReqs:outReqs})
})

app.get('/root/posts/*', authToken, checkNotifs, function(req, res){
    postId = req.originalUrl.replace("/root/posts/", "")
    Image.countDocuments({_id:postId}, async function(err,result){
        if(err){
            console.error(err)
        }else{
            if(result>0){ //If image exists?
                Image.findById(postId, async function(err, image){
                    likeButton = ``
                    likeResult = await isImageLiked(image, req.user.name)
                    username = req.user.name
                    if(likeResult===true) likeButton = `<a href="/root/like/${image._id}?post=${image._id}" title="Liked"><button class="btn btn-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                    else if(likeResult==="user") likeButton = `<button class="btn btn-outline-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>`
                    else likeButton = `<a href="/root/like/${image._id}?post=${image._id}"><button class="btn btn-outline-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                    imageCard = `
                    <div class="card" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                        <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                        <div class="card-body">
                            <h5 class="card-title">Also known as ${image.commonName}</h2>
                            <p class="card-text">Named by ${image.foundBy}</h2>
                            <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                            <div style="width:100%;text-align:center; margin-bottom:1rem;">
                                ${likeButton} <p class='text-muted' style="margin-left:5%;display:inline-block;"><i class="bi bi-eye"></i> ${pluralize(image.views.length,'view')}</p>
                            </div>
                            <p class='text-muted' style="text-align:center;margin-bottom:.25rem;">${image.accuracy}% accurate.</p>
                        </div>
                    </div>
                    `
                    if(!image.views.includes(req.user.name)){
                        image.views.push(req.user.name)
                        image.save()
                    }
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

app.get('/root/user/*', authToken, checkNotifs, async function(req, res){
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
            <div class="col-md-2"><div class="card" style="max-width: 20rem;">
                <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                <div class="card-body">
                    <a href="/root/posts/${image._id}"><h5 class="card-title">${image.plantName}</h1></a>
                    <h6 class="card-subtitle">Also known as ${image.commonName}</h2>
                    <p class="card-text">Named by ${image.foundBy}</h2>
                    <p class="card-text">${image.genus} belongs to the ${image.family} family.</p>
                    <div style="width:100%;text-align:center; margin-bottom:1rem;">
                        ${likeButton} <p class='text-muted' style="margin-left:5%;display:inline-block;"><i class="bi bi-eye"></i> ${pluralize(image.views.length,'view')}</p>
                    </div>
                    <p class='text-muted' style="text-align:center;margin-bottom:.25rem;">${image.accuracy}% accurate.</p>
                </div>
            </div></div>
            `
        imagesString += imageCard
        if(!image.views.includes(req.user.name)){
            image.views.push(req.user.name)
            image.save()
        }
    })
    user = await User.findOne({username:username})
    currentUser = await User.findOne({username:req.user.name})
    if(!user){return res.render('pages/public/404')}

    linkMeta = `
    <meta property="og:title" content="GardenX" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://gardenx.herokuapp.com" />
    <meta property="og:description" content="Find ${user.username}'s garden and others on GardenX." />
    <meta name="theme-color" content="#FF0000">
    `
    friendButton = ``
    if(user.friends.includes(req.user.name)){
        friendButton = `<a href="/root/friend/${user.username}"><button class="btn btn-danger">Unfriend</button></a>`
    }else if(currentUser.requests.includes(username)){ friendButton = `<a href="/root/friend/${user.username}"><button class="btn btn-outline-danger">Cancel Request</button></a>`
    }else if(user.requests.includes(req.user.name)){ friendButton = `<a href="/root/accept/${user.username}"><button class="btn btn-success">Accept</button></a><a href="/root/deny/${user.username}"><button class="btn btn-danger">Deny</button></a>`}
    else if(req.user.name==username){friendButton = ``}
    else{ friendButton = `<a href="/root/friend/${user.username}"><button class="btn btn-success">Add Friend</button></a>` }

    if(user.imagePublic){
        res.render('pages/public/user', {username:username,images:imagesString, linkPreview:linkMeta,friendButton:friendButton})
    }else{
        res.render('pages/public/404')
    }
})

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
app.get('/root/search', authToken, checkNotifs, async function(req, res){
    cardStr = ``
    if(!req.query.search){return res.redirect('/root')}
    search = new RegExp(req.query.search, 'i')
    results = await Image.find({$text:{$search:search}})
    resultsUsers = await Image.find({user:search})
    users = await User.find({username:search})
    results.push.apply(results, resultsUsers)
    results = results.filter((v,i,a)=>a.findIndex(t=>(t.url === v.url))===i) //Removes duplicates
    if(results.length == 0 && users.length == 0 && resultsUsers.length == 0){
        return res.render('pages/search')}
    else{
        if(users!=null && users.length>0){
            cardStr += `
            <h3>Users</h3>
            <div class="card-deck mx-auto" style="padding-left:10%;padding-right:10%;padding-top:2rem;">`
            for(const user of users){
                if(user.username === req.user.name){continue}
                stats = await getUserPlantsLikes(user)
                userCard = `
                <div class="card mx-auto" style="margin-left: 1rem; margin-right: 1.5rem;width:30%;">
                    <div class="card-body">
                        <h5 class="card-title">${user.username}</h5>
                        <p class="card-text">${pluralize(stats[0],'plant')}</p>
                        <p class="card-text">${pluralize(stats[1],'total like')}</p>
                        <a href="/root/user/${user.username}" class="card-link">View Profile</a>
                    </div>
                </div>
                `
                cardStr += userCard
            }
            cardStr +='</div><br/>'
        }
        if(results != null && results.length >0){
            cardStr += `
            <h3 style="margin-bottom:2rem;">Plants</h3>
            <div class="row row-cols-1 row-cols-md-4 d-flex justify-content-center" style="width:100%;padding-left:2rem;text-align:auto;" data-masonry='{"percentPosition": true, "itemSelector":".col-md-2"}'>`
            for(const image of results){
                poster = await User.findOne({username:image.user})
                if(poster != null && !poster.imagePublic){continue}
                likeButton = ``
                likeResult = await isImageLiked(image, req.user.name)
                if(likeResult===true) likeButton = `<a href="/root/like/${image._id}" title="Liked"><button class="btn btn-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                else if(likeResult==="user") likeButton = `<button class="btn btn-outline-success disabled"><i class="bi bi-heart"></i> ${image.likes.length.toString()}</button>`
                else likeButton = `<a href="/root/like/${image._id}"><button class="btn btn-outline-danger"><i class="bi bi-heart-fill"></i> ${image.likes.length.toString()}</button></a>`
                imageStr = `
                <div class="col-md-2"><div class="card mx-auto" style="max-width: 20rem; margin-left: 1rem; margin-right: 1.5rem;">
                    <a role="button" class="imageOnClick"><img class="card-img-top" src="${image.url}"></a>
                    <div class="card-body">
                        <a href="/root/posts/${image._id}"><h5 class="card-title">${image.user}'s ${image.plantName}</h1></a>
                        <p class="card-text">${image.family} family</p>
                        <div style="width:100%;text-align:center;">
                            ${likeButton} <p class='text-muted' style="margin-left:5%;display:inline-block;"><i class="bi bi-eye"></i> ${image.views.length}</p>
                        </div>
                    </div>
                </div></div>
                `
                cardStr += imageStr
            }
            cardStr += `</div>`
        }
    }
    res.render("pages/search",{search:req.query.search,results:cardStr})   
})

app.get('/root/friend/*', authToken, async function(req,res){
    userTo = req.originalUrl.replace('/root/friend/', '')
    if(userTo==req.user.name){return res.redirect(prevURL(req))}
    cUser = await User.findOne({username:req.user.name})
    friendMessage = ``

    if(cUser.friends.includes(userTo)){ //User is already a friend, unfriend
        friendMessage = `<p>${req.user.name} has unfriended you. Friend them <a href="/root/user/${req.user.name}">here</a></p>`
        await Notif.create({type:'unfriend',sender:req.user.name,receivers:[userTo],msg:friendMessage})
        await User.findOneAndUpdate({username:userTo}, {$pull:{friends:req.user.name}})
        cUser.friends.pull(userTo)
        cUser.save()
        return res.redirect(prevURL(req))} 
    else if(cUser.requests.includes(userTo)){ //Already requested the user, cancel request
        cUser.requests.pull(userTo)
        cUser.save()
    }else{ //Create request
        friendMessage = `<p>${req.user.name} has sent you a friend request. Accept or deny in the <a href="/root/friends">Friends</a> menu.</p>`
        await Notif.create({type:'friend',sender:req.user.name,receivers:[userTo],msg:friendMessage})
        cUser.requests.push(userTo)
        cUser.save()
    }
    res.redirect(prevURL(req))

})

app.get('/root/accept/*', authToken, async function(req,res){
    userTo = req.originalUrl.replace('/root/accept/', '')
    otherUser = await User.findOne({username:userTo})
    if(otherUser.requests.includes(req.user.name)){
        otherUser.requests.pull(req.user.name)
        otherUser.friends.push(req.user.name)
        otherUser.save()

        await User.findOneAndUpdate({username:req.user.name}, {$push:{friends:userTo}})
    }
    return res.redirect(prevURL(req))
})

app.get('/root/deny/*', authToken, async function(req,res){
    userTo = req.originalUrl.replace('/root/deny/', '')
    otherUser = await User.findOne({username:userTo})
    if(otherUser.requests.includes(req.user.name)){
        otherUser.requests.pull(req.user.name)
        otherUser.save()
    }
    return res.redirect(prevURL(req))
})

app.get('/root/remove/*', authToken, async function(req, res){
    plantToRemove = req.originalUrl.replace('/root/remove/','')
    plant = await Image.findOneAndRemove({_id:plantToRemove,user:req.user.name})
    res.redirect(prevURL(req))
})

//Keep every other route above this
app.get('*', function(req, res) {
    res.redirect('/root');
});

//node . --update ONLY RUN IF NEEDS TO CHANGE SOME VALUES AND UPDATE "update" BELOW
if(process.argv.length > 2 && process.argv[2] == '--update'){
    update = {'views': []}
    Image.updateMany({}, {"$set": update}, function(err,res){
        if(err){console.error(err)}
        else{console.log("Updated Successfully")}
    })
}
app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})