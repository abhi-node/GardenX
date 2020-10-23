const express = require('express');
const path = require('path');
var bodyParser  = require('body-parser');
const app = express();


app.use(bodyParser.json());
var urlEncodedParser = bodyParser.urlencoded({extended: false});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/html/index.html'))
})

app.get('/ninja', (req, res) => {
    res.send('you are a ninja')
})

app.post('/login', urlEncodedParser, (req, res) => {
    res.sendFile(path.join(__dirname + '/html/onLogin.html'));
    console.log(req.body.email);
    console.log(req.body.password);
})

app.listen(process.env.PORT || 3000, () => {
    console.log('Now listening on 3000')
})
