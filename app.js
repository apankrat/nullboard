const express = require('express');
const app = express();
const port = 3000;
const path = require('path');
const basicAuth = require('express-basic-auth')
const bodyParser = require('body-parser');
require('dotenv').config();

// app configuration
app.use(bodyParser.urlencoded({extended: false}));
app.use('/extras', express.static('extras'));

// basic authentication
let users = {};
users[process.env.USERNAME] = process.env.PASSWD;
var staticUserAuth = basicAuth({
  users: users,
  challenge: true
})

// initialize redis
var redis = require('redis');
var client = redis.createClient({ host: process.env.REDIS_HOST, port: process.env.REDIS_PORT, password: process.env.REDIS_PW });
client.on('error', function (err) {
  console.log('error event - ' + client.host + ':' + client.port + ' - ' + err);
});
client.on("connect", function () {
  console.log("You are now connected");
});

// routes
app.get('/', staticUserAuth, (req, res) => {
  res.sendFile(path.join(__dirname + '/nullboard.html'));
})

app.post('/save', staticUserAuth, (req, res) => {
  client.hmset(`nullboard.board.${req.body.boardId}`, {boardRevision: req.body.boardRevision, boardContent: req.body.boardContent}, function(err, reply) {
    console.log(req.body.boardId);
    console.log("Saved Successfully!");
    res.send();
  });
})

app.get('/delete', staticUserAuth, (req, res) => {
  console.log(`nullboard.board.${req.query.id}`);
  client.del(`nullboard.board.${req.query.id}`, function(err, response) {
    if (response == 1) {
       console.log("Deleted Successfully!");
    } else{
     console.log("Cannot delete");
    }
 })
})

app.get('/get', staticUserAuth, (req, res) => {
  client.hgetall(`nullboard.board.${req.query.id}`, function(err, object) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(object));
  });
})

app.get('/getBoardIds', staticUserAuth, (req, res) => {
  client.keys('nullboard.board.*', function(err, object){
    console.log(object);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(object));
  })
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
})
