const mongoose = require('mongoose')
const Schema = mongoose.Schema 

//create user schema + model
const ImageSchema = new Schema({
    plantName: {
        type: String,
        required: [true, 'plant name required']
    },
    commonName: {
        type: String,
        require: [true, 'common name required']
    },
    foundBy: {
        type: String,
        require: [true, 'author required']
    },
    genus: {
        type: String,
        required: [true, 'genus is required']
    },
    family: {
        type: String,
        required: [true, 'family is required']
    },
    accuracy: {
        type: Number,
        required: [true, 'accuracy is required']
    },
    user:{
        type: String,
        required: [true, 'user is required']
    },
    url: {
        type: String,
        required: [true, 'url is required']
    },
    public: { //Is image publicly avaliable?
        type: Boolean,
        default: true
    },
    likes:{
        type:[String],
        default: []
    }


    
})

const Image = mongoose.model('image', ImageSchema, 'image')

module.exports = Image