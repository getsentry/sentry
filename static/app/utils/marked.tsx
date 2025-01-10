import dompurify from 'dompurify';
import type {MarkedOptions} from 'marked'; // eslint-disable-line no-restricted-imports
import {marked} from 'marked'; // eslint-disable-line no-restricted-imports
import Prism from 'prismjs';

import {NODE_ENV} from 'sentry/constants';
import {loadPrismLanguage} from 'sentry/utils/prism';

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

    const out = super.link(href, title, text);
    return dompurify.sanitize(out);
  }

  image(href: string, title: string, text: string) {
    // For a bad image, return an empty string
    if (this.options.sanitize && !isSafeHref(href, safeImagePattern)) {
      return '';
    }

    return super.image(href, title, text);
  }
}

class LimitedRenderer extends marked.Renderer {
  link(href: string) {
    return href;
  }

  image(href: string) {
    return href;
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

  highlight: (code, lang, callback) => {
    if (!lang) {
      return code;
    }

    if (lang in Prism.languages) {
      return Prism.highlight(code, Prism.languages[lang]!, lang);
    }

    loadPrismLanguage(lang, {
      onLoad: () =>
        callback?.(null!, Prism.highlight(code, Prism.languages[lang]!, lang)),
      onError: error => callback?.(error, code),
      suppressExistenceWarning: true,
    });

    return code;
  },

  // Silence sanitize deprecation warning in test / ci (CI sets NODE_NV
  // to production, but specifies `CI`).
  //
  // [!!] This has the side effect of causing failed markdown content to render
  //      as a html error, instead of throwing an exception, however none of
  //      our tests are rendering failed markdown so this is likely a safe
  //      tradeoff to turn off off the deprecation warning.
  silent: NODE_ENV === 'test',
});

const limitedMarked = (text: string, options: MarkedOptions = {}) =>
  sanitizedMarked(text, {...options, renderer: new LimitedRenderer()});

const sanitizedMarked = (src: string, options?: MarkedOptions) => {
  return dompurify.sanitize(marked(src, options));
};

const singleLineRenderer = (text: string, options: MarkedOptions = {}) =>
  sanitizedMarked(text, {...options, renderer: new NoParagraphRenderer()});

export {singleLineRenderer, limitedMarked};
export default sanitizedMarked;
