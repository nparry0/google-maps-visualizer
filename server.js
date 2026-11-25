const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/parser.js': ['parser.js', 'text/javascript; charset=utf-8'],
  '/vendor/leaflet/leaflet.js': ['vendor/leaflet/leaflet.js', 'text/javascript; charset=utf-8'],
  '/vendor/leaflet/leaflet.js.map': ['vendor/leaflet/leaflet.js.map', 'application/json'],
  '/vendor/leaflet/leaflet.css': ['vendor/leaflet/leaflet.css', 'text/css; charset=utf-8'],
  '/vendor/leaflet/images/layers.png': ['vendor/leaflet/images/layers.png', 'image/png'],
  '/vendor/leaflet/images/layers-2x.png': ['vendor/leaflet/images/layers-2x.png', 'image/png'],
  '/vendor/leaflet/images/marker-icon.png': ['vendor/leaflet/images/marker-icon.png', 'image/png'],
  '/vendor/leaflet/images/marker-icon-2x.png': ['vendor/leaflet/images/marker-icon-2x.png', 'image/png'],
  '/vendor/leaflet/images/marker-shadow.png': ['vendor/leaflet/images/marker-shadow.png', 'image/png']
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