import dompurify from 'dompurify';
import type {Tokens} from 'marked'; // eslint-disable-line no-restricted-imports
import {Marked, marked} from 'marked'; // eslint-disable-line no-restricted-imports
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
  link(tokens: Tokens.Link) {
    // For a bad link, just return the plain text href
    if (!isSafeHref(tokens.href, safeLinkPattern)) {
      return tokens.href;
    }

    const out = super.link(tokens);
    return dompurify.sanitize(out, {
      FORBID_ATTR: ['style'],
    });
  }

  image(tokens: Tokens.Image) {
    // For a bad image, return an empty string
    if (!isSafeHref(tokens.href, safeImagePattern)) {
      return '';
    }

    return super.image(tokens);
  }
}

class NoParagraphRenderer extends SafeRenderer {
  paragraph(tokens: Tokens.Paragraph) {
    // Do not render the paragraph but still render sub-tokens
    return super.text({...tokens, type: 'text'});
  }
}

function postprocess(html: string) {
  return dompurify.sanitize(html, {
    // Forbid style attributes to prevent CSS injection attacks
    // This is the primary security fix to prevent arbitrary CSS injection
    FORBID_ATTR: ['style'],
    // Keep default tag allowlist but remove dangerous attributes
    // This prevents CSS injection while preserving markdown functionality
  });
}

const noHighlightingMarked = new Marked({
  async: false,
  renderer: new SafeRenderer(),
  hooks: {
    postprocess,
  },
});

const highlightingMarked = new Marked(
  markedHighlight({
    async: true,
    highlight: async (code, lang, _info): Promise<string> => {
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

      return new Promise(resolve => {
        loadPrismLanguage(lang, {
          onError: () => {
            resolve(code);
          },
          onLoad: () => {
            try {
              const highlighted = Prism.highlight(code, Prism.languages[lang]!, lang);
              resolve(highlighted);
            } catch (e) {
              resolve(code);
            }
          },
          suppressExistenceWarning: true,
        });
      });
    },
  })
).use({
  async: true,
  renderer: new SafeRenderer(),
  hooks: {
    postprocess,
  },
});

/**
 * Renders markdown and sanitizes the output.
 * Applies syntax highlighting. See `useMarked` for use in react.
 */
export const asyncSanitizedMarked = (src: string, inline?: boolean): Promise<string> => {
  return inline
    ? highlightingMarked.parse(src, {async: true, renderer: new NoParagraphRenderer()})
    : highlightingMarked.parse(src, {async: true});
};

/**
 * Renders markdown and sanitizes the output.
 * WARNING: Does not apply any syntax highlighting.
 */
export const sanitizedMarked = (src: string): string => {
  return noHighlightingMarked.parse(src, {async: false});
};

/**
 * Renders a single line of markdown not wrapped in a paragraph tag.
 * WARNING: Does not apply any syntax highlighting.
 */
export const singleLineRenderer = (text: string): string => {
  // https://marked.js.org/using_advanced#inline
  return noHighlightingMarked.parse(text, {
    async: false,
    renderer: new NoParagraphRenderer(),
  });
};
