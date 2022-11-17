// ./node_modules/.bin/terser -c -m --module fixtures/sourcemaps/original.js --source-map "includeSources,base=fixtures/sourcemaps,url=minified.js.map" -o fixtures/sourcemaps/minified.js
function abcd() {
  throw new Error();
}
export default abcd;
