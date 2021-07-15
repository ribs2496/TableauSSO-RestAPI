var axios = require('axios');
var util = require('util');
var xml2js = require('xml2js');
var fs = require('fs');
var pipe = require('pipe');
var express = require('express');
var session = require('express-session');
var path = require('path');


var app = express();

app.set('view-engine', 'ejs');

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

var parser = new xml2js.Parser();


var server = 'https://ebi-au-1.niometrics.com/api/3.11/auth/signin';

var login_body = `<tsRequest>
<credentials
  personalAccessTokenName="test_restAPI" personalAccessTokenSecret="uV4jbwmXTpG8BUbAmGx+Rg==:VhlKVLoqzuBOvGEzGtvplgo09sUjTUKl" >
      <site contentUrl="" />
</credentials>
</tsRequest>`

var config = {
    headers: {
        'Content-Type': 'application/xml',
        'Accept': '*/*'
    }
};

var siteID = ''
var userID = ''
var userCred = ''
var view_Names = []
var workbook_Names = []
var server2 = 'http://ebi-au-1.niometrics.local';
var ticket = ''
var username = ''

app.get('/', function(request, response) {
  response.render('DynamicEmbed.ejs', {views: view_Names, tick: ticket});
});

async function login() {
  //Login to access the API
  var res_Login = await axios.post(server,login_body,config) 
  var text = res_Login.data;
  //Using xml2js package to convert the xml response recieved to JSON and then parsing it
  parser.parseString(text, (err, result) => {   
      res = util.inspect(result, false, null, true);
      // Saving the user id, auth cred token and the site id associated
      userCred = result.tsResponse.credentials[0].$.token
      siteID = result.tsResponse.credentials[0].site[0].$.id
      userID = result.tsResponse.credentials[0].user[0].$.id
  });
  configTest = {   
    headers: {
        'Content-Type': 'application/xml',
        'Accept': '*/*',
        'X-Tableau-Auth': userCred
    }
  };
  // Getting user details using the UserID. This is to use the recieved username with Tableau Trusted Authentication SSO.
  var res_User = await axios.get("https://ebi-au-1.niometrics.com/api/3.11/sites/"+siteID+"/users/"+userID,configTest)
  var text = res_User.data;
  parser.parseString(text, (err, result) => {   
    res = util.inspect(result, false, null, true);
    username = result.tsResponse.user[0].$.name;
  });
    try{
      var res_Ticket = await axios({
      method: 'post',
      url: server2+'/trusted',
      data: 'username='+username+'&server='+encodeURI(server2, "UTF-8")
      });
      ticket = res_Ticket.data;
  } catch(e){
      console.error(e);
  }
  getWorkbooks(userCred, siteID, userID)
}


  //Get workbooks which the logged in user has rights to
  async function getWorkbooks(userCred, siteID, userID) {
    config1 = {   
      headers: {
          'Content-Type': 'application/xml',
          'Accept': '*/*',
          'X-Tableau-Auth': userCred
      }
    };
    try{
      var res_Workbooks = await axios.get("https://ebi-au-1.niometrics.com/api/3.11/sites/"+siteID+"/users/"+userID+"/workbooks",config1)
      var res_workbooks = res_Workbooks.data;
      parser.parseString(res_workbooks, (err, result) => {
      res_Workbooks = util.inspect(result, false, null, true);
      var len = result.tsResponse.workbooks[0].workbook.length
      for(var i = 0; i<len; i++){
        workbook_Names.push({
          id : result.tsResponse.workbooks[0].workbook[i].$.id,
          contentUrl : result.tsResponse.workbooks[0].workbook[i].$.contentUrl
        })
      }
    });
    } catch(e) {
      console.error(e)
    }
    getViews(workbook_Names)
  }

//Get list of views on a workbook
async function getViews(workbook_Names) {
  for(var i = 0; i<workbook_Names.length; i++){
    var res_Views = await axios.get("https://ebi-au-1.niometrics.com/api/3.11/sites/"+siteID+"/workbooks/"+workbook_Names[i].id+"/views", config1);
    var res_Views = res_Views.data;
    parser.parseString(res_Views, (err, result) => {
      res_Views = util.inspect(result, false, null, true);
      view_Names.push({
        viewId : result.tsResponse.views[0].view[0].$.id,
        viewName : result.tsResponse.views[0].view[0].$.viewUrlName,
        workbookID : workbook_Names[i].id,
        workbookName : workbook_Names[i].contentUrl
      })
    });
  }
  getThumbnail()
}
//Create embed link for JS API using contentUrl from the workbooks command + viewUrlName from the views command

  
  
  //Get thumbnail for a particular workbook
  async function getThumbnail() {
    config2 = {   
      headers: {
          'Content-Type': 'application/xml',
          'Accept': '*/*',
          'X-Tableau-Auth': userCred
      },
      responseType : 'stream'
    };
    for(i=0;i<view_Names.length;i++) {
      try{
        await axios.get("https://ebi-au-1.niometrics.com/api/3.11/sites/"+siteID+"/views/"+view_Names[i].viewId+"/image", config2).then(response => response.data.pipe(fs.createWriteStream('thumb_'+view_Names[i].viewName+".png")))
      } catch(e) {
        console.error(e)
      }
    }
  }
  
  //Getting active alerts on the site
  async function getAlerts() {
    var res_Alerts = await axios.get("https://ebi-au-1.niometrics.com/api/3.11/sites/"+siteID+"/dataAlerts", config1);    
    var alerts = res_Alerts.data;
    parser.parseString(alerts, (err, result) => {
      text = util.inspect(result, false, null, true);
    });
  }

  //Getting user's favorites
  async function getFavorites() {
    var res_Favorites = await axios.get("https://ebi-au-1.niometrics.com/api/3.11/sites/"+siteID+"/favorites/"+userID, config1);
    var res_Favorites=res_Favorites.data;
    parser.parseString(res_Favorites, (err, result) => {
      text = util.inspect(result, false, null, true);
    });
}

login()

app.listen(3000);
