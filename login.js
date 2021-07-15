var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var axios = require('axios');
var path = require('path');



var connection = mysql.createConnection({
	host     : 'localhost',
	user     : 'root',
	password : 'root121212',
	database : 'nodelogin'
});

connection.connect(function(err) {
    if (err) {
		return console.error('error: ' + err.message);
	  }
    console.log("Database Connected!");
  });

var app = express();

app.set('view-engine', 'ejs');

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.get('/', function(request, response) {
	response.sendFile(path.join(__dirname + '/login.html'));
});

app.get('/view1', (req,res)=> {
	res.render('view1.ejs', {tick: req.session.ticket})
})

app.get('/view2', (req,res)=> {
	res.render('view2.ejs', {tick: req.session.ticket})
})

var server = 'http://ebi-au-1.niometrics.local';

/* 	- backend server 	http://ebi-au-1.niometrics.local
	- frontend server	https://ebi-au-1.niometrics.com */ 


app.post('/auth', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	
	if (username && password) {
		connection.query('SELECT * FROM accounts WHERE username = ? AND password = ?', [username, password], function(error, results, fields) {
			if (results.length > 0) {
				request.session.loggedin = true;
				request.session.username = username;
				console.log("User " + username + " logged in");
				response.redirect('/home');
			} else {
				response.send('Incorrect Username and/or Password!');
			}
			response.end();
		});
	} else {
		response.end();
	}
});

app.get('/home', async function(req, res) {
    var ticket = ''
    if (req.session.loggedin) {
        try{
            var response = await axios({
            method: 'post',
            url: server+'/trusted',
            data: 'username='+req.session.username+'&server='+encodeURI(server, "UTF-8")
            });
			if (response.data == '-1') {
				var response = await axios({
				method: 'post',
				url: server+'/trusted',
				data: 'username=flavia'+'&server='+encodeURI(server, "UTF-8")
				});
				console.log("User not found in Tableau server, Logging in using defualt user")
			}
            req.session.ticket = response.data;
            ticket = req.session.ticket;
            console.log("User ticket " + ticket);
            res.render('getViews.ejs', {tick: req.session.ticket});
        } catch(e){
            console.error(e);
            res.send('Error');
        }
    } else {
        res.send('Please login to view this page!');
    }
});

app.listen(3000);