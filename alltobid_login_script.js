require('colors');
const fs = require('fs');
const request = require('request');
const shelljs = require('shelljs');
const crypto = require('crypto');

const BIDDING_DATE = '20170520'; // Note that BIDDING_DATE should be updated
if(BIDDING_DATE != (function(){
        var today = new Date();
        var yyyy = today.getFullYear();
        var mm   = today.getMonth() + 1;
        var dd   = today.getDate();
        return ''+yyyy+(mm<10?('0'+mm):mm)+(dd<10?('0'+dd):dd);
    })()) {
    console.log('----------------------------------------');
    console.log('+      Is BIDDING_DATE up to date?     +');
    console.log('----------------------------------------');
    process.exit(0);
}

const PROTOCOL = 'https';
const UNIQUEID_AND_IMAGEURL = ['', ''];
var BID_CLIENTS = require('./nodejs/config/BidClients');

function md5(txt){
    return crypto.createHash('md5').update(txt).digest('hex');
}
function getTimestamp() {
    return new Date().getTime().toString();
}
function getRequestId() {
    return getTimestamp();
}
function parseJSON(str) {
    if(/^"\{.*/.test(str)) {
        console.log('It is not a standard JSON string, gotta remove the leading " and ending "');
        str = str.replace(/^"|"$/g,'');
    }
    return JSON.parse(str);
}

// step 1. get image code
var timestamp = getTimestamp();
var requestid = getRequestId();
var version = "1.0";
var checkcode = requestid + timestamp + version;
var cmd = {
    "version":"1.0",
    "timestamp":timestamp,
    "requestid":timestamp,
    "request":{},
    "checkcode":md5(checkcode)
};
cmd = encodeURIComponent(JSON.stringify(cmd));
var curl = [
    "curl 'https://paimai.alltobid.com/webwcf/BidCmd.svc/WebCmd'",
    " -H 'Origin: ", PROTOCOL, "://paimai.alltobid.com'",
    " -H 'Accept-Encoding: gzip, deflate, br'",
    " -H 'Accept-Language: en,zh-CN;q=0.8,zh;q=0.6,zh-TW;q=0.4'",
    " -H 'User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'", // 伪装成IE11
    " -H 'Content-Type: application/json'",
    " -H 'Accept: application/json, text/javascript, */*; q=0.01'",
    " -H 'Referer: ", PROTOCOL, "://paimai.alltobid.com/bid/", BIDDING_DATE, "01/login.htm'",
    " -H 'X-Requested-With: XMLHttpRequest'",
    " -H 'Connection: keep-alive'",
    " --data-binary '{\"method\":\"getimagecode\",\"cmd\":\"", cmd, "\"}' --compressed"].join('');
console.log('curl: ' + curl);
var jsonString = shelljs.exec(curl).stdout;

var imagecodeRes = parseJSON(jsonString);
if(imagecodeRes.response.responsecode !== 0) {
    console.log('failed to get uniqueid and imgurl');
    process.exit(0);
}

// got uniqueidAndImgUrl
var uniqueidAndImgUrl = imagecodeRes.response.data.split(',');
UNIQUEID_AND_IMAGEURL[0] = uniqueidAndImgUrl[0];
UNIQUEID_AND_IMAGEURL[1] = uniqueidAndImgUrl[1];
request(UNIQUEID_AND_IMAGEURL[1]).pipe(fs.createWriteStream('/tmp/LoginImageCode.png'));

console.log(("查看/tmp/LoginImageCode.png，得到验证码（比如1234），然后在新的terminal中执行echo 1234 > /tmp/LoginImageCode.txt").white);
fs.watch('/tmp', function(event, filename){
    if (filename == 'LoginImageCode.txt') {
        fs.readFile('/tmp/LoginImageCode.txt', 'utf-8', function(err, data){
            var imagenumber = data.trim();
            BID_CLIENTS.forEach(function(b){
                login(b.bidnumber, b.password, b.id, imagenumber);
            });
        });
    }
});

function login(bidnumber, bidpassword, idcard, imagenumber){
    var bidpassword = md5(bidnumber + bidpassword);

    var version = "1.0";
    var timestamp = getTimestamp();
    var requestid = getRequestId();
    var checkcode = bidpassword + bidnumber + imagenumber + idcard + requestid + UNIQUEID_AND_IMAGEURL[0] + version;
    var cmd = {
        "version":version,
        "timestamp":timestamp,
        "bidnumber":bidnumber,
        "requestid":requestid,
        "checkcode":md5(checkcode),
        "request":{
            "info":"Win7;ie:11;25", // Hey alltobid, I'm using IE11 on the Win7 platform, and I have Adobe flash player v25 installed!
            "uniqueid":UNIQUEID_AND_IMAGEURL[0],
            "bidnumber":bidnumber,
            "bidpassword":bidpassword,
            "imagenumber":imagenumber,
            "idcard":idcard||"",
            "clientId":"",
            "idtype":"0"
        }
    };
    cmd = encodeURIComponent(JSON.stringify(cmd));
    var curl = [
        "curl '", PROTOCOL, "://paimai.alltobid.com/webwcf/BidCmd.svc/WebCmd'",
        " -H 'Origin: ", PROTOCOL, "://paimai.alltobid.com'",
        " -H 'Accept-Encoding: gzip, deflate, br'",
        " -H 'Accept-Language: en,zh-CN;q=0.8,zh;q=0.6,zh-TW;q=0.4'",
        " -H 'User-Agent: Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'",
        " -H 'Content-Type: application/json'",
        " -H 'Accept: application/json, text/javascript, */*; q=0.01'",
        " -H 'Referer: ", PROTOCOL, "://paimai.alltobid.com/bid/", BIDDING_DATE, "01/login.htm'",
        " -H 'X-Requested-With: XMLHttpRequest'",
        " -H 'Connection: keep-alive'",
        " --data-binary '{\"method\":\"login\",\"cmd\":\"", cmd, "\"}' --compressed"].join('');
    console.log('curl: ' + curl);
    var jsonString = shelljs.exec(curl).stdout;
    var loginRes = parseJSON(jsonString);
    if (loginRes.response.responsecode === 0) {
        var loginData = loginRes.response.loginData;
        console.log('loginData:' + loginData);

        // $.cookie('bidnumber', bidnumber);
        // $.cookie('username', loginData.name);
        // $.cookie('clientId' + bidnumber, loginData.clientid);
        // $.cookie('bidcount', loginData.bidcount);
        // $.cookie('vdate', loginData.date);
        // $.cookie('pwd', loginData.b);

        var traderserverstr = '';
        for (var i = 0; i < loginData.tradeserver.length; i++) {
            traderserverstr += ',' + loginData.tradeserver[i].server + ':' + loginData.tradeserver[i].port
        }
        if (traderserverstr !== '') traderserverstr = traderserverstr.substring(1);

        // $.cookie('tradeserver', traderserverstr);

        var webserverstr = '';
        for (var k = 0; k < loginData.webserver.length; k++) {
            webserverstr += ',' + loginData.webserver[k].server + ':' + loginData.webserver[k].port
        }
        if (webserverstr !== '') webserverstr = webserverstr.substring(1);

        // $.cookie('webserver', webserverstr)

        // curl to inject params
        var cookieString = encodeURIComponent([
            "clientId", bidnumber, "=", loginDta.clientid,
            "; bidnumber=", bidnumber,
            "; username=", loginData.name,
            "; clientId", bidnumber, "=", loginData.clientid,
            "; bidcount=", loginData.bidcount,
            "; vdate=",loginData.date,
            "; pwd=", loginData.b,
            "; tradeserver=", traderserverstr,
            "; webserver=", webserverstr, ";"].join(''));
        var curl = "curl 'http://localhost:8888/cookie/" + cookieString;
        console.log('curl: ' + curl);
        shelljs.exec(curl);
    } else if (loginRes.response.responsecode === 4021) {
        // should not happen
        console.log(loginRes.response.responsemsg);
        console.log('需要输入身份证号');
    } else if (loginRes.response.responsecode === 2101) {
        console.log(loginRes.response.responsemsg);
    } else {
        console.log(loginRes.response.responsemsg);
    }
}
