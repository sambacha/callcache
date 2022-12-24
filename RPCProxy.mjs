#!/usr/bin/env node
// @file RPCProxy
// @param curl -X POST localhost:8546/goerli --data "{\"jsonrpc\": \"2.0\", \"method\": \"eth_blockNumber\", \"params\": [], \"id\": 1}"
// @returns = {"jsonrpc":"2.0","id":1,"result":"0x7cFd6"}

const http = require('http');
const https = require('https');

const port = 8546;
const server = http.createServer(handle).listen(port);
const cache = {};

function cacheKey(url, data) {
  const rpc = JSON.parse(data);
  delete rpc.id;
  return `${url}:${JSON.stringify(rpc)}`;
}

function uncache(hit, data) {
  const rpc = JSON.parse(data);
  const res = JSON.parse(hit);
  res.id = rpc.id;
  return JSON.stringify(res);
}

function defaultHeaders(headers = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  }
}

function jsonHeaders(headers = {}) {
  return defaultHeaders({
    'Content-Type': 'application/javascript',
    ...headers
  })
}

async function handle(req, res) {
  switch (req.method) {
  case 'POST': return handlePost(req, res);
  case 'OPTIONS': return handleOptions(req, res);
    case 'GET': return handleOptions(req, res);
  default:
    res.writeHead(500, jsonHeaders());
    res.end(JSON.stringify({error: `cannot handle ${req.method}`}));
  }
}

async function handleOptions(req, res) {
  res.writeHead(200, defaultHeaders());
  res.end('');
}

async function handlePost(req, res) {
  let data = ''
  req.on('data', (d) => data += d);
  req.on('end', async () => {
    const key = cacheKey(req.url, data);
    const hit = cache[key];
    if (hit) {
      res.writeHead(200, jsonHeaders());
      res.end(uncache(hit, data));
    } else {
      const [network] = req.url.substr(1).split('/');
      try {
        // TODO: host?
        const result = await fetch({
          host: `localhost://${network}`,
          method: req.method,
          path: `/`,
          data: data
        });
        res.writeHead(200, jsonHeaders());
        res.end(cache[key] = result);
      } catch (e) {
        console.error(e)
        res.writeHead(500, jsonHeaders());
        // TODO
        res.end(JSON.stringify({error: 'request failed'}));
      }
    }
  });
}

async function fetch(options) {
  console.log('Requesting...', options);
  let data = ''
  return new Promise(
    (okay, fail) => {
      const req = https.request(options, (res) => {
        console.log('...responded', options);
        res.on('data', (d) => data += d);
        res.on('end', () => okay(data));
      });
      req.on('error', (e) => fail(e));
      req.end(options.data);
    });
}
