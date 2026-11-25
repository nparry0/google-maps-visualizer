const fs = require('node:fs');
const topojson = require('topojson-client');
const world = require('world-atlas/countries-110m.json');

const countries = topojson.feature(world, world.objects.countries);
fs.mkdirSync('vendor', { recursive: true });
fs.writeFileSync('vendor/countries.js', 'window.WorldCountries = ' + JSON.stringify(countries) + ';\n');