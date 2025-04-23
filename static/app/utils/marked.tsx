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
 * Implementation of marked. Renderer which additionally sanitizes URLs.
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

class NoParagraphRenderer extends SafeRenderer {
  paragraph(tokens: Tokens.Paragraph) {
    // Do not render the paragraph but still render sub-tokens
    return super.text({...tokens, type: 'text'});
  }
}

function preprocess(markdown: string) {
  // Allow no html tags at all in the preprocess step.
  // GitHub and others allow this, we could in the future.
  return dompurify.sanitize(markdown, {ALLOWED_TAGS: []});
}

marked.use({
  async: false,
  renderer: new SafeRenderer(),
  hooks: {
    preprocess,
  },
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

      // TODO: Switch to `async: true`
      // The old version of marked let us use a callback to update code after a language loaded.
      // The new version uses promises instead, which would require API changes.
      // This means if a language isn't loaded yet, the syntax highlighting won't apply
      // until the component rerenders after the language loads.
      loadPrismLanguage(lang, {
        onError: () => {},
        onLoad: () => {},
        suppressExistenceWarning: true,
      });
      return code;
    },
  })
);

type NonAsyncMarkedOptions = Omit<MarkedOptions, 'hooks'> & {async: false};

const sanitizedMarked = (
  src: string,
  options: NonAsyncMarkedOptions = {async: false}
) => {
  return dompurify.sanitize(marked(src, options));
};

const noParagraphRenderer = new NoParagraphRenderer();
const singleLineRenderer = (
  text: string,
  options: NonAsyncMarkedOptions = {async: false}
) => {
  return sanitizedMarked(text, {...options, renderer: noParagraphRenderer});
};

export {singleLineRenderer};
export default sanitizedMarked;
