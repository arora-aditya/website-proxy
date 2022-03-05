const { forEach, get, isString, mapValues, uniq } = require('lodash');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const NodeCache = require('node-cache');
const https = require('follow-redirects').https;
const axios = require('axios');
const { Client } = require('@notionhq/client');



const PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || 'localhost';

const API_KEY = process.env.CLIENT_ID || '9a6e05eaccedd9aa6080a02b75caefa9';
const CONFIG = JSON.parse(process.env.CONFIG || '{}');

const app = express();

const token = process.env.LICHESS_TOKEN || '';
const notion_token = process.env.NOTION_ACCESS_TOKEN
// every key lives for  1hour = 60*60s, and refreshed every 10 minutes
const myCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 } );
const notion = new Client({ auth: notion_token });

app.get('/spotify', async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const body = await axios.get('http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=arora_aditya&api_key=' + API_KEY + '&format=json');
  res.send(body.data.recenttracks.track[0]);
})

const getPage = async (pageId) => {
  const response = await notion.pages.retrieve({ page_id: pageId });
  return response;
};

const getBlocks = async (blockId) => {
  const blocks = [];
  let cursor;
  while (true) {
    const { results, next_cursor } = await notion.blocks.children.list({
      start_cursor: cursor,
      block_id: blockId,
    });
    blocks.push(...results);
    if (!next_cursor) {
      break;
    }
    cursor = next_cursor;
  }
  return blocks;
};

app.get('/nownownow', async (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const id = 'ed2ef9437f95407aa970aa20e66b08af'
  const page = await getPage(id);
  const blocks = await getBlocks(id);

  // Retrieve block children for nested blocks (one level deep), for example toggle blocks
  // https://developers.notion.com/docs/working-with-page-content#reading-nested-blocks
  const childBlocks = await Promise.all(
    blocks
      .filter((block) => block.has_children)
      .map(async (block) => {
        return {
          id: block.id,
          children: await getBlocks(block.id),
        };
      })
  );
  const blocksWithChildren = blocks.map((block) => {
    // Add child blocks if the block should contain children but none exists
    if (block.has_children && !block[block.type].children) {
      block[block.type]["children"] = childBlocks.find(
        (x) => x.id === block.id
      )?.children;
    }
    return block;
  });

  res.send({page, blocksWithChildren});
  next();
})

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
