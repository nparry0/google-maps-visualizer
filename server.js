const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/parser.js': ['parser.js', 'text/javascript; charset=utf-8'],
  '/node_modules/leaflet/dist/leaflet.js': ['node_modules/leaflet/dist/leaflet.js', 'text/javascript; charset=utf-8'],
  '/node_modules/leaflet/dist/leaflet.css': ['node_modules/leaflet/dist/leaflet.css', 'text/css; charset=utf-8']
};

http.createServer(function (request, response) {
  const file = files[new URL(request.url, 'http://localhost').pathname];
  if ((request.method !== 'GET' && request.method !== 'HEAD') || !file) {
    response.writeHead(404).end();
    return;
  }
  fs.readFile(path.join(__dirname, file[0]), function (error, content) {
    if (error) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': file[1] });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
}).listen(Number(process.env.PORT) || 4173, '127.0.0.1', function () {
  console.log('Viewer running at http://127.0.0.1:' + this.address().port);
});