import marked from 'marked'; // eslint-disable-line no-restricted-imports
import dompurify from 'dompurify';

import {IS_CI, NODE_ENV} from 'app/constants';

// Only https and mailto, (e.g. no javascript, vbscript, data protocols)
const safeLinkPattern = /^(https?:|mailto:)/i;

const safeImagePattern = /^https?:\/\/./i;

function isSafeHref(href: string, pattern: RegExp) {
  try {
    return pattern.test(decodeURIComponent(unescape(href)));
  } catch {
    return false;
  }
}

/**
 * Implementation of marked.Renderer which additonally sanitizes URLs.
 */
class SafeRenderer extends marked.Renderer {
  link(href: string, title: string, text: string) {
    // For a bad link, just return the plain text href
    if (!isSafeHref(href, safeLinkPattern)) {
      return href;
    }

    const out = `<a href="${href}"${title ? ` title="${title}"` : ''}>${text}</a>`;
    return dompurify.sanitize(out);
  }

  image(href: string, title: string, text: string) {
    // For a bad image, return an empty string
    if (this.options.sanitize && !isSafeHref(href, safeImagePattern)) {
      return '';
    }

    return `<img src="${href}" alt="${text}"${title ? ` title="${title}"` : ''} />`;
  }
}

class NoParagraphRenderer extends SafeRenderer {
  paragraph(text: string) {
    return text;
  }
}

marked.setOptions({
  renderer: new SafeRenderer(),
  sanitize: true,

  // Silence sanitize deprecation warning in test / travs (Travis sets NODE_NV
  // to production, but specifies `CI`).
  //
  // [!!] This has the side effect of causing failed markdown content to render
  //      as a html error, instead of throwing an exception, however none of
  //      our tests are rendering failed markdown so this is likely a safe
  //      tradeoff to turn off off the deprecation warning.
  silent: !!IS_CI || NODE_ENV === 'test',
});

const sanitizedMarked = (...args: Parameters<typeof marked>) =>
  dompurify.sanitize(marked(...args));

const singleLineRenderer = (text: string, options: marked.MarkedOptions = {}) =>
  sanitizedMarked(text, {...options, renderer: new NoParagraphRenderer()});

export {singleLineRenderer};
export default sanitizedMarked;
