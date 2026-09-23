import dompurify from 'dompurify';
import type {MarkedToken, Token, Tokens} from 'marked'; // eslint-disable-line no-restricted-imports
import {Lexer as MarkedLexer, Marked, marked} from 'marked'; // eslint-disable-line no-restricted-imports
import {markedHighlight} from 'marked-highlight';
import Prism from 'prismjs';

import {loadPrismLanguage} from '@sentry/scraps/code/prism';

import type {TagToken} from './extensions/tag';
import {extensions} from './extensions';

export {MarkedLexer};
export type {MarkedToken, Token};
export type {ExtendedToken} from './extensions';

// globally registered, applies to all instances
marked.use({extensions: [...extensions]});

const SAFE_LINK_PATTERN = /^(https?:|mailto:)/i;
const INTERNAL_PATH_PATTERN = /^\/[^/]/;

/** One piece of a source string: literal text, or a tag with its parsed body. */
export type TagSegment =
  | {type: 'text'; value: string}
  | {
      attrs: Record<string, string>;
      data: unknown;
      level: 'block' | 'inline';
      name: string;
      type: 'tag';
    };

/**
 * A list keeps its content on `items`; everything else that nests keeps it on
 * `tokens`. Table cells are neither -- marked gives them no `raw`, so there is
 * nothing to locate them by, and a tag written in a table stays literal.
 */
function childTokens(token: Token): Token[] {
  const nested = token as {items?: Token[]; tokens?: Token[]};
  return nested.items ?? nested.tokens ?? [];
}

/**
 * Walks a token list against the source it came from, emitting the text in
 * between and a segment for each tag.
 *
 * Each token is located from where the previous one ended, inside its parent's
 * source rather than the whole document. Searching globally would match the
 * first identical string anywhere -- so a tag shown literally in a code fence
 * would be taken for a later, real one.
 */
function walkSource(slice: string, tokens: Token[], out: TagSegment[]): void {
  let cursor = 0;

  for (const token of tokens) {
    const raw = (token as {raw?: string}).raw;
    if (raw === undefined) {
      continue;
    }

    const at = slice.indexOf(raw, cursor);
    if (at === -1) {
      continue;
    }
    if (at > cursor) {
      out.push({type: 'text', value: slice.slice(cursor, at)});
    }

    if (token.type === 'tag') {
      const tag = token as unknown as TagToken;
      out.push({
        type: 'tag',
        name: tag.name,
        attrs: tag.attrs,
        data: tag.data,
        level: tag.level,
      });
    } else {
      const children = childTokens(token);
      if (children.length > 0) {
        walkSource(raw, children, out);
      } else {
        // `code` and `codespan` land here, which is what keeps a tag written
        // inside them literal.
        out.push({type: 'text', value: raw});
      }
    }

    cursor = at + raw.length;
  }

  if (cursor < slice.length) {
    out.push({type: 'text', value: slice.slice(cursor)});
  }
}

/**
 * Splits a source string into its text and its tags, in document order.
 *
 * Lexed the way the document lexes it, so a tag only counts as one where the
 * document would render it as one, and the text around them is returned exactly
 * as written.
 */
export function splitTags(src: string): TagSegment[] {
  const segments: TagSegment[] = [];
  walkSource(src, MarkedLexer.lex(src), segments);
  return segments;
}

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

const ALLOWED_ATTR = ['href', 'title', 'alt', 'class', 'align'];

export function sanitizeHtml(html: string) {
  // DOMPurify returns a TrustedHTML under Trusted Types and a plain string
  // otherwise. Every caller either assigns it to innerHTML, which takes both,
  // or lets the DOM stringify it, so the pipeline stays typed as string.
  return dompurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    RETURN_TRUSTED_TYPE: true,
  }) as unknown as string;
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
          const grammar = Prism.languages[lang];
          return grammar ? Prism.highlight(code, grammar, lang) : code;
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
              const grammar = Prism.languages[lang];
              if (!grammar) {
                resolve(code);
                return;
              }
              const highlighted = Prism.highlight(code, grammar, lang);
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
 * Renders markdown to sanitized HTML and returns its visible text, stripping
 * markdown syntax and any HTML/XML tags. Use when markdown must be shown as
 * plain text (e.g. a single-line title) rather than rendered.
 */
export function markdownToPlainText(src: string): string {
  const html = sanitizedMarked(src);
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  return text.trim();
}

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
      return (token as Tokens.List).items.some(hasVisibleToken);
    default:
      if ('tokens' in token && token.tokens && token.tokens.length > 0) {
        return token.tokens.some(hasVisibleToken);
      }
      return 'text' in token && typeof token.text === 'string'
        ? token.text.trim().length > 0
        : false;
  }
}
