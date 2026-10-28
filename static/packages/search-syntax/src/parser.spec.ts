import {readdirSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';

import {
  getKeyName,
  parseSearch,
  parseSearchOrThrow,
  TokenConverter,
  type FilterToken,
  type KeyToken,
  type ParseResultToken,
  type SearchConfig,
} from './parser';
import {FilterType, TermOperator, Token} from './tokens';

// The frontend parser and the backend `event_search.py` grammar test against
// the same fixtures, so they are the contract between all three.
const FIXTURES_DIR = resolve(__dirname, '../../../../fixtures/search-syntax');

type FixtureCase = {
  query: string;
  result: unknown[];
  additionalConfig?: Partial<SearchConfig> & Record<string, unknown>;
  raisesError?: boolean;
};

// Location, text, `parsed` values, and validation results are frontend
// concerns the structural converter does not produce; compare everything else.
const STRIPPED_KEYS = new Set([
  'location',
  'text',
  'config',
  'parsed',
  'invalid',
  'warning',
]);

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !STRIPPED_KEYS.has(key))
        .map(([key, inner]) => [key, normalize(inner)])
    );
  }
  return value;
}

const fixtureFiles = readdirSync(FIXTURES_DIR).filter(file => file.endsWith('.json'));

describe('search-syntax fixtures', () => {
  it('loads the shared fixtures', () => {
    expect(fixtureFiles.length).toBeGreaterThan(70);
  });

  for (const file of fixtureFiles) {
    const cases = JSON.parse(
      readFileSync(join(FIXTURES_DIR, file), 'utf-8')
    ) as FixtureCase[];

    // eslint-disable-next-line jest/valid-title
    describe(file.replace(/\.json$/, ''), () => {
      for (const testCase of cases) {
        it(`handles ${JSON.stringify(testCase.query)}`, () => {
          const result = parseSearch(testCase.query, {
            config: testCase.additionalConfig,
          });
          if (testCase.raisesError) {
            expect(result).toBeNull();
            return;
          }
          expect(result).not.toBeNull();
          expect(normalize(result)).toEqual(normalize(testCase.result));
        });
      }
    });
  }
});

describe('parseSearch', () => {
  it('keeps exact text and offsets on every token', () => {
    const query = '!level:error count():>10 (a OR b)';
    const result = parseSearchOrThrow(query);
    expect(result.map(token => token.text).join('')).toBe(query);
    for (const token of result) {
      expect(query.slice(token.location.start.offset, token.location.end.offset)).toBe(
        token.text
      );
    }
  });

  it('classifies typed filters from the default key sets', () => {
    const result = parseSearchOrThrow(
      'transaction.duration:>1s error.handled:true timestamp:-24h count():>10'
    );
    const filters = result.filter(
      (token): token is FilterToken => token.type === Token.FILTER
    );
    expect(filters.map(filter => filter.filter)).toEqual([
      FilterType.DURATION,
      FilterType.BOOLEAN,
      FilterType.RELATIVE_DATE,
      FilterType.AGGREGATE_NUMERIC,
    ]);
    expect(filters[0]?.operator).toBe(TermOperator.GREATER_THAN);
  });

  it('reads aggregate size filters only when an argument is a size key', () => {
    const filterOf = (query: string, config?: Partial<SearchConfig>) =>
      parseSearchOrThrow(query, {config}).find(
        (token): token is FilterToken => token.type === Token.FILTER
      );
    const sized = {sizeKeys: new Set(['span.size'])};

    expect(filterOf('avg(span.size):>1kb', sized)?.filter).toBe(
      FilterType.AGGREGATE_SIZE
    );
    // Like duration values on a non-duration aggregate, a size value on a
    // non-size aggregate isn't a typed filter.
    expect(filterOf('avg(span.duration):>1kb', sized)).toBeUndefined();
    expect(filterOf('avg(span.size):>1kb')).toBeUndefined();
    expect(filterOf('avg(span.duration):>1s')).toBeUndefined();
  });

  it('returns null for queries that do not parse, and throws from parseSearchOrThrow', () => {
    // The grammar falls back to free text for almost anything; a newline
    // outside quotes is one of the few inputs it rejects.
    expect(parseSearch('release:a\nrelease')).toBeNull();
    expect(() => parseSearchOrThrow('release:a\nrelease')).toThrow();
  });

  it('builds paren tokens instead of groups with flattenParenGroups', () => {
    const grouped = parseSearchOrThrow('(a:b)');
    expect(grouped.map(token => token.type)).toContain(Token.LOGIC_GROUP);
    const flat = parseSearchOrThrow('(a:b)', {
      config: {flattenParenGroups: true},
    });
    expect(flat.map(token => token.type)).toEqual([
      Token.SPACES,
      Token.L_PAREN,
      Token.SPACES,
      Token.FILTER,
      Token.SPACES,
      Token.R_PAREN,
      Token.SPACES,
    ]);
  });

  it('uses a converter subclass for validation', () => {
    class NoFreeText extends TokenConverter {
      override checkInvalidFreeText(value: string) {
        return {type: 'free-text-not-allowed', reason: `no "${value}"`};
      }
    }
    const result = parseSearchOrThrow('hello', {converter: NoFreeText});
    const freeText = result.find(token => token.type === Token.FREE_TEXT);
    expect(freeText).toMatchObject({
      invalid: {type: 'free-text-not-allowed', reason: 'no "hello"'},
    });
  });
});

describe('regex filters', () => {
  type RegexFilter = {key: string; negated: boolean; pattern: string};

  function regexFilters(query: string): RegexFilter[] {
    const found: RegexFilter[] = [];
    const visit = (tokens: ParseResultToken[]): void => {
      for (const token of tokens) {
        if (token.type === Token.LOGIC_GROUP) {
          visit(token.inner);
        } else if (
          token.type === Token.FILTER &&
          token.operator === TermOperator.MATCHES
        ) {
          found.push({
            key: token.key.text,
            pattern: token.value.text,
            negated: token.negated,
          });
        }
      }
    };
    visit(parseSearchOrThrow(query, {config: {allowRegex: true}}));
    return found;
  }

  const regex = (key: string, pattern: string, negated = false) => ({
    key,
    pattern,
    negated,
  });

  it.each([
    // Pattern contents: commas, brackets, boolean words, parens and quotes
    // all stay inside the pattern.
    ['message://[a-z,]+//', [regex('message', '[a-z,]+')]],
    ['message://codes [401,403,) seen//', [regex('message', 'codes [401,403,) seen')]],
    ['message://timeout OR refused//', [regex('message', 'timeout OR refused')]],
    ['message://read AND write//', [regex('message', 'read AND write')]],
    [
      'message://(reset|timeout) [0-9,]+//',
      [regex('message', '(reset|timeout) [0-9,]+')],
    ],
    ['message://say "hi" [a,]//', [regex('message', 'say "hi" [a,]')]],
    [
      String.raw`!message://^GET OR POST \d+ms//`,
      [regex('message', String.raw`^GET OR POST \d+ms`, true)],
    ],
    // The pattern ends at the first `//` followed by whitespace.
    [
      'url://https://x// AND message://a OR b//',
      [regex('url', 'https://x'), regex('message', 'a OR b')],
    ],
    // Every key shape that can carry a regex.
    ['tags[foo,string]://[a-z,]+ AND b//', [regex('tags[foo,string]', '[a-z,]+ AND b')]],
    ['tags[foo, string]://a OR [b,]//', [regex('tags[foo, string]', 'a OR [b,]')]],
    ['tags[sentry:user]://^id [0-9,]+//', [regex('tags[sentry:user]', '^id [0-9,]+')]],
    ['tags[App:Region]://^us-//', [regex('tags[App:Region]', '^us-')]],
    ['flags[beta,string]://^on OR off$//', [regex('flags[beta,string]', '^on OR off$')]],
    ['flags[Feature:X]://y//', [regex('flags[Feature:X]', 'y')]],
    ['"my.key"://a OR [b,]//', [regex('"my.key"', 'a OR [b,]')]],
    [
      'arr[*]://a OR [b,]// tags[k[*],array]://a OR b//',
      [regex('arr[*]', 'a OR [b,]'), regex('tags[k[*],array]', 'a OR b')],
    ],
    // Regex filters directly after a paren group or quoted text, and inside
    // a paren group.
    [
      '(level:x)message://[a,]// "foo"message://[b,]//',
      [regex('message', '[a,]'), regex('message', '[b,]')],
    ],
    ['"Note"message://a b//', [regex('message', 'a b')]],
    ['(message://a b//)', [regex('message', 'a b')]],
  ])('parses %j', (query, expected) => {
    expect(regexFilters(query)).toEqual(expected);
  });

  it('reads key://pattern// as a literal text filter without allowRegex', () => {
    const filter = parseSearchOrThrow('message://^Timeout//').find(
      (token): token is FilterToken => token.type === Token.FILTER
    );
    expect(filter).toMatchObject({
      filter: FilterType.TEXT,
      operator: TermOperator.DEFAULT,
    });
    expect(filter?.value.text).toBe('//^Timeout//');
  });
});

describe('getKeyName', () => {
  function firstKey(query: string): KeyToken {
    const filter = parseSearchOrThrow(query).find(
      (token): token is FilterToken => token.type === Token.FILTER
    );
    if (!filter) {
      throw new Error(`no filter in ${query}`);
    }
    return filter.key;
  }

  it('names each key kind the way the API expects', () => {
    expect(getKeyName(firstKey('level:error'))).toBe('level');
    expect(getKeyName(firstKey('tags[foo]:bar'))).toBe('foo');
    expect(getKeyName(firstKey('tags[foo,number]:1'))).toBe('tags[foo,number]');
    expect(getKeyName(firstKey('flags[beta]:on'))).toBe('flags[beta]');
    expect(getKeyName(firstKey('foo[*]:bar'))).toBe('foo');
    expect(getKeyName(firstKey('count():>1'))).toBe('count');
    expect(
      getKeyName(firstKey('p95(span.duration):>1'), {
        aggregateWithArgs: true,
      })
    ).toBe('p95(span.duration)');
  });
});
