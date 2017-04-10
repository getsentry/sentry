import marked from 'marked';

function isSafeHref(href, pattern) {
  try {
    return pattern.test(decodeURIComponent(unescape(href)));
  } catch(e) {
    return false;
  }
}


// We need to implement our own marked Renderer to not render
// potentially malicious uris.
// This is copy/pasted from
// https://github.com/chjj/marked/blob/master/lib/marked.js#L869-L888
// and modified.
function Renderer() {
  return marked.Renderer.apply(this, arguments);
}
Object.assign(Renderer.prototype, marked.Renderer.prototype);

// Anythign except javascript, vbscript, data protocols
const safeLinkPattern = /^(?!javascript|vbscript|data:)/i;

Renderer.prototype.link = function(href, title, text) {
  // For a bad link, just return the plain text href
  if (this.options.sanitize && !isSafeHref(href, safeLinkPattern)) return href;

  let out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += '>' + text + '</a>';
  return out;
};


// Only allow http(s) for image tags
const safeImagePattern = /^https?:\/\/./i;

Renderer.prototype.image = function(href, title, text) {
  // For a bad image, return an empty string
  if (this.options.sanitize && !isSafeHref(href, safeImagePattern)) return '';

  let out = '<img src="' + href + '" alt="' + text + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += this.options.xhtml ? '/>' : '>';
  return out;
};

marked.setOptions({
  renderer: new Renderer(),
  // Disable all HTML input and only accept Markdown
  sanitize: true
});

export default marked;
