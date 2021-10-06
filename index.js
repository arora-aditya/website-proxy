const { forEach, get, isString, mapValues, uniq } = require('lodash');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const NodeCache = require('node-cache');
const https = require('follow-redirects').https;
const fs = require('fs');

const qs = require('querystring');

const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || 'localhost';

const CONFIG = JSON.parse(process.env.CONFIG || '{}');

const app = express();
app.use(helmet());

const token = process.env.LICHESS_TOKEN || '';
console.log(token);
// every key lives for  1hour = 60*60s, and refreshed every 10 minutes
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 } );

app.get('/', (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const result = myCache.get("result");
  if(result === undefined){
    var options = {
      'method': 'GET',
      'hostname': 'lichess.org',
      'path': '/api/games/user/SwanJaguar?max=10&pgnInJson=false&moves=false&opening=true',
      'headers': {
        'Accept': 'application/x-ndjson',
        'Authorization': `Bearer ${token}`
      },
      'maxRedirects': 20
    };
    
    var ireq = https.request(options, function (ires) {
      var chunks = [];

      ires.on("data", function (chunk) {
        chunks.push(chunk);
      });

      ires.on("end", function (chunk) {
        var body = Buffer.concat(chunks);
        const data = body;
        const result = `[${data.toString().trim().split('\n').join(',')}]`;
        myCache.set("result", result);
        res.send(result);
      });

      ires.on("error", function (error) {
        res.send({error: "Error while getting data from Lichess"})
        console.error(error);
      });
    });

    ireq.end();
  } else {
    res.send(result);
  }
})

const server = http.createServer(app);

server.on('listening', () => {
  console.log(`http://${HOST}:${PORT}`);
});

server.listen(PORT);
