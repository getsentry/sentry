import dompurify from 'dompurify';
import type {MarkedToken, Token, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports
import {Lexer as MarkedLexer, Marked, marked} from 'marked'; // eslint-disable-line no-restricted-imports
import {markedHighlight} from 'marked-highlight';
import Prism from 'prismjs';

import {extensions} from 'sentry/utils/marked/extensions';
import {loadPrismLanguage} from 'sentry/utils/prism';

export {MarkedLexer};
export type {MarkedToken, Token};
export type {ExtendedToken} from './extensions';

// globally registered, applies to all instances
marked.use({extensions: [...extensions]});

const SAFE_LINK_PATTERN = /^(https?:|mailto:)/i;
const INTERNAL_PATH_PATTERN = /^\/[^/]/;

export function isSafeHref(href: string): boolean {
  try {
    return SAFE_LINK_PATTERN.test(decodeURIComponent(unescape(href)));
  } catch {
    return false;
  }
}

export function isInternalHref(href: string): boolean {
  try {
    return INTERNAL_PATH_PATTERN.test(decodeURIComponent(unescape(href)));
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
    if (!isSafeHref(tokens.href)) {
      return tokens.href;
    }

    const out = super.link(tokens);
    return sanitizeHtml(out);
  }
}

class NoParagraphRenderer extends SafeRenderer {
  paragraph(tokens: Tokens.Paragraph) {
    // Do not render the paragraph but still render sub-tokens
    return super.text({...tokens, type: 'text'});
  }
}

/**
 * Allowlist of HTML tags that markdown rendering can produce.
 * Using an allowlist rather than a blocklist ensures unexpected tags
 * (style, form, input, script, iframe, etc.) are stripped by default.
 */
const ALLOWED_TAGS = [
  // Block elements
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'li',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  // Inline elements
  'a',
  'code',
  'em',
  'strong',
  'del',
  'span',
  'b',
  'i',
  'sub',
  'sup',
];

const ALLOWED_ATTR = ['href', 'title', 'alt', 'class', 'id', 'align'];

export function sanitizeHtml(html: string) {
  return dompurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

function postprocess(html: string) {
  return sanitizeHtml(html);
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

/**
 * Whether markdown renders any output a reader can see. Some valid markdown
 * collapses to nothing — most commonly a bare or empty code fence (```), which
 * renders an empty `<pre><code>` box. Callers can fall back to showing the raw
 * text so the content isn't swallowed into a blank space. See TET-2670.
 */
export function markdownRendersVisibleContent(text: string): boolean {
  if (text.trim().length === 0) {
    return false;
  }
  return MarkedLexer.lex(text).some(hasVisibleToken);
}

// A token renders something visible if it is a rule/image/table, or it (or a
// descendant) carries non-whitespace text. An empty code fence and bare
// whitespace are the notable tokens that carry none.
function hasVisibleToken(token: Token): boolean {
  switch (token.type) {
    case 'space':
      return false;
    // Images render nothing in this app: `sanitizeHtml` strips `<img>` (not in
    // ALLOWED_TAGS), and its `alt` is dropped along with it. So image-only
    // content must fall back to raw text, not count as visible. This needs an
    // explicit case ahead of `default` — an image token carries its alt as
    // child text tokens, which the default branch would otherwise treat as
    // visible text.
    case 'image':
      return false;
    case 'hr':
    case 'table':
      return true;
    case 'list':
      return token.items.some(hasVisibleToken);
    default:
      if ('tokens' in token && token.tokens && token.tokens.length > 0) {
        return token.tokens.some(hasVisibleToken);
      }
      return 'text' in token && typeof token.text === 'string'
        ? token.text.trim().length > 0
        : false;
  }
}
