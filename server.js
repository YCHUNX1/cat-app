const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = 8080;

const types = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml'
};

http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if(p==='/') p='/index.html';
  const file = path.join(root, p);
  if(!file.startsWith(root)){ res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(file,(err,data)=>{
    if(err){ res.writeHead(404); return res.end('404 Not Found'); }
    res.writeHead(200, {'Content-Type': types[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  });
}).listen(port, ()=>{
  console.log('Cat prototype running at http://localhost:' + port);
});
