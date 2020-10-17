const express = require('express')
const path = require('path')
const app = express()

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/html/index.html'))
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})