import dompurify from 'dompurify';
import type {MarkedOptions, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports
import {marked} from 'marked'; // eslint-disable-line no-restricted-imports
import {markedHighlight} from 'marked-highlight';
import Prism from 'prismjs';

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
  link({href, title, text, ...rest}: Tokens.Link) {
    // For a bad link, just return the plain text href
    if (!isSafeHref(href, safeLinkPattern)) {
      return href;
    }

    const out = super.link({href, title, text, ...rest});
    return dompurify.sanitize(out);
  }

  image({href, title, text, ...rest}: Tokens.Image) {
    // For a bad image, return an empty string
    if (!isSafeHref(href, safeImagePattern)) {
      return '';
    }

    return super.image({href, title, text, ...rest});
  }
}

class LimitedRenderer extends marked.Renderer {
  link({href}: Tokens.Link) {
    return href;
  }

  image({href}: Tokens.Image) {
    return href;
  }
}

class NoParagraphRenderer extends SafeRenderer {
  paragraph({text}: Tokens.Paragraph) {
    return text;
  }
}

marked.setOptions({
  renderer: new SafeRenderer(),
  async: false,
});

marked.use(
  markedHighlight({
    async: false,
    highlight: (code, lang, _info): string => {
      if (!lang) {
        return code;
      }

      if (lang in Prism.languages) {
        try {
          return Prism.highlight(code, Prism.languages[lang]!, lang);
        } catch (e) {
          return code;
        }
      }

      // This is really hacky because the previous version had a callback that let you update code
      // once the language was loaded. The new versioon makes the entire call to marked async, which
      // requires a migration to the new API.
      // This can cause the syntax highlight not to load if the component does not rerender after the language is loaded.
      // The ideal solution would be to move to the async api
      loadPrismLanguage(lang, {
        onError: () => {},
        onLoad: () => {},
        suppressExistenceWarning: true,
      });
      return code;
    },
  })
);

type NonAsyncMarkedOptions = MarkedOptions & {async: false};

const limitedMarked = (text: string, options: NonAsyncMarkedOptions = {async: false}) => {
  return sanitizedMarked(text, {...options, renderer: new LimitedRenderer()});
};

const sanitizedMarked = (
  src: string,
  options: NonAsyncMarkedOptions = {async: false}
) => {
  const rawHtml = marked(src, options);
  return dompurify.sanitize(rawHtml);
};

const singleLineRenderer = (
  text: string,
  options: NonAsyncMarkedOptions = {async: false}
) => {
  return sanitizedMarked(text, {...options, renderer: new NoParagraphRenderer()});
};

export {singleLineRenderer, limitedMarked};
export default sanitizedMarked;
