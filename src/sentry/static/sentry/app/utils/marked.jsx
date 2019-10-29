import marked from 'marked';
import dompurify from 'dompurify';

function isSafeHref(href, pattern) {
  try {
    return pattern.test(decodeURIComponent(unescape(href)));
  } catch (e) {
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

// Only https and mailto, (e.g. no javascript, vbscript, data protocols)
const safeLinkPattern = /^(https?:|mailto:)/i;

Renderer.prototype.link = function(href, title, text) {
  // For a bad link, just return the plain text href
  if (this.options.sanitize && !isSafeHref(href, safeLinkPattern)) {
    return href;
  }

  let out = '<a href="' + href + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += '>' + text + '</a>';
  return dompurify.sanitize(out);
};

// Only allow http(s) for image tags
const safeImagePattern = /^https?:\/\/./i;

Renderer.prototype.image = function(href, title, text) {
  // For a bad image, return an empty string
  if (this.options.sanitize && !isSafeHref(href, safeImagePattern)) {
    return '';
  }

  let out = '<img src="' + href + '" alt="' + text + '"';
  if (title) {
    out += ' title="' + title + '"';
  }
  out += this.options.xhtml ? '/>' : '>';
  return dompurify.sanitize(out);
};

marked.setOptions({
  renderer: new Renderer(),
  // Disable all HTML input and only accept Markdown
  sanitize: true,
});

const noParagraphRenderer = new Renderer();
noParagraphRenderer.paragraph = s => s;

const singleLineRenderer = (text, options) =>
  marked(text, {...options, renderer: noParagraphRenderer});

export default marked;
export {singleLineRenderer};
