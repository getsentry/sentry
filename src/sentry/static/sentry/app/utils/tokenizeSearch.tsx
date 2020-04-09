import flatMap from 'lodash/flatMap';

import {escapeDoubleQuotes} from 'app/utils';

export type QueryResults = {
  /**
   * The text portion of the string query
   */
  query: string[];
  [k: string]: string[];
};

/**
 * Tokenize a search into an object
 *
 * Example:
 *   tokenizeSearch('is:resolved foo bar tag:value');
 *   {
 *     is ['resolved'],
 *     query: ['foo', 'bar'],
 *     tag: ['value'],
 *   }
 *
 * Should stay in sync with src.sentry.search.utils:tokenize_query
 */
export function tokenizeSearch(query: string) {
  const tokens = splitSearchIntoTokens(query);

  const searchParams: {query: string[]; tags: string[]} = {
    query: [],
    tags: [],
  };

  for (const token of tokens) {
    let tokenState: 'query' | 'tags' = 'query';

    // Traverse the token and determine if it is a tag
    // condition or bare words.
    for (let i = 0, len = token.length; i < len; i++) {
      const char = token[i];

      if (i === 0 && (char === '"' || char === ':')) {
        break;
      }

      // We may have entered a tag condition
      if (char === ':') {
        const nextChar = token[i + 1] || '';
        if ([':', ' '].includes(nextChar)) {
          tokenState = 'query';
        } else {
          tokenState = 'tags';
        }
        break;
      }
    }
    searchParams[tokenState].push(token);
  }

  const results: QueryResults = {
    query: searchParams.query.map(formatQuery),
  };

  for (const tag of searchParams.tags) {
    const [key, value] = formatTag(tag);
    results[key] = Array.isArray(results[key]) ? [...results[key], value] : [value];
  }

  return results;
}

/**
 * Convert a QueryResults object back to a query string
 */
export function stringifyQueryObject(results: QueryResults) {
  const {query, ...tags} = results;

  const stringTags = flatMap(Object.entries(tags), ([k, values]) =>
    values.map(tag => {
      if (tag === '' || tag === null) {
        return `${k}:""`;
      }
      if (/[\s\(\)\\"]/g.test(tag)) {
        return `${k}:"${escapeDoubleQuotes(tag)}"`;
      }
      return `${k}:${tag}`;
    })
  );

  return `${query.join(' ')} ${stringTags.join(' ')}`.trim();
}

/**
 * Splits search strings into tokens for parsing by tokenizeSearch.
 */
function splitSearchIntoTokens(query: string) {
  const queryChars = Array.from(query);
  const tokens: string[] = [];

  let token = '';
  let endOfPrevWord = '';
  let quoteType = '';
  let quoteEnclosed = false;

  queryChars.forEach((char, idx) => {
    const nextChar = queryChars.length - 1 > idx ? queryChars[idx + 1] : null;
    token += char;

    if (nextChar !== null && !isSpace(char) && isSpace(nextChar)) {
      endOfPrevWord = char;
    }

    if (isSpace(char) && !quoteEnclosed && endOfPrevWord !== ':' && !isSpace(token)) {
      tokens.push(token.trim());
      token = '';
    }

    if (["'", '"'].includes(char) && (!quoteEnclosed || quoteType === char)) {
      quoteEnclosed = !quoteEnclosed;
      if (quoteEnclosed) {
        quoteType = char;
      }
    }
  });

  const trimmedToken = token.trim();
  if (trimmedToken !== '') {
    tokens.push(trimmedToken);
  }

  return tokens;
}

/**
 * Checks if the string is only spaces
 */
function isSpace(s: string) {
  return s.trim() === '';
}

/**
 * Splits tags on ':' and removes enclosing quotes if present, and returns both
 * sides of the split as strings.
 */
function formatTag(tag: string) {
  const idx = tag.indexOf(':');
  const key = tag.slice(0, idx).replace(/^"+|"+$/g, '');
  const value = tag.slice(idx + 1).replace(/^"+|"+$/g, '');

  return [key, value];
}

/**
 * Strips enclosing quotes from a query, if present.
 */
function formatQuery(query: string) {
  return query.replace(/^"+|"+$/g, '');
}
