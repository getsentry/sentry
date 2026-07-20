import {ProjectFixture} from 'sentry-fixture/project';

import {WildcardOperators} from 'sentry/components/searchSyntax/parser';

import {
  formatQueryToNaturalLanguage,
  generateQueryTokensString,
  getExpandedProjectIds,
  parseNaturalLanguageToQuery,
  resolveSeerProjectSelection,
} from './utils';

// A realistic key predicate for the parse tests.
const KNOWN_KEYS = new Set([
  'is',
  'assigned',
  'browser',
  'browser.name',
  'event.type',
  'error.type',
  'count()',
  'transaction.duration',
  'release',
]);
const isKey = (key: string) => KNOWN_KEYS.has(key);

describe('getExpandedProjectIds', () => {
  it.each([
    {returned: null, selected: [1, 2]},
    {returned: undefined, selected: [1, 2]},
    {returned: [], selected: [1, 2]},
    {returned: [1, 2], selected: [1, 2]},
    {returned: [1], selected: [1, 2]},
  ])(
    'returns undefined when $returned does not expand beyond $selected',
    ({returned, selected}) => {
      expect(getExpandedProjectIds(returned, selected)).toBeUndefined();
    }
  );

  it.each([
    {returned: [1, 2, 3], selected: [1, 2]},
    {returned: [5], selected: []},
  ])(
    'returns $returned when it includes projects beyond $selected',
    ({returned, selected}) => {
      expect(getExpandedProjectIds(returned, selected)).toEqual(returned);
    }
  );
});

describe('resolveSeerProjectSelection', () => {
  const projects = [
    ProjectFixture({id: '11', slug: 'seer'}),
    ProjectFixture({id: '22', slug: 'sentry'}),
  ];

  it('resolves a project slug filter to the selector and strips it from the query', () => {
    expect(resolveSeerProjectSelection('project:seer span.op:db', projects)).toEqual({
      projectIds: [11],
      query: 'span.op:db',
    });
  });

  it('resolves the whole query to just the project selector', () => {
    expect(resolveSeerProjectSelection('project:seer', projects)).toEqual({
      projectIds: [11],
      query: '',
    });
  });

  it('resolves multiple project slugs', () => {
    expect(
      resolveSeerProjectSelection('project:[seer,sentry] span.op:db', projects)
    ).toEqual({projectIds: [11, 22], query: 'span.op:db'});
  });

  it('takes project.id values directly', () => {
    expect(resolveSeerProjectSelection('project.id:22 span.op:db', projects)).toEqual({
      projectIds: [22],
      query: 'span.op:db',
    });
  });

  it('leaves unresolvable project slugs in the query', () => {
    expect(resolveSeerProjectSelection('project:unknown span.op:db', projects)).toEqual({
      projectIds: undefined,
      query: 'project:unknown span.op:db',
    });
  });

  it('leaves the whole filter untouched when only some project values resolve', () => {
    // `seer` resolves but `unknown` does not; don't partially apply and drop
    // the unresolvable constraint.
    expect(
      resolveSeerProjectSelection('project:[seer,unknown] span.op:db', projects)
    ).toEqual({projectIds: undefined, query: 'project:[seer,unknown] span.op:db'});
  });

  it('does not lift branch-scoped project conditions out of an OR', () => {
    // Lifting both projects to the global selector would change the meaning:
    // `(a AND /a) OR (b AND /b)` is not `(a OR b) AND (/a OR /b)`.
    const query = '(project:seer span.name:/a) OR (project:sentry span.name:/b)';
    expect(resolveSeerProjectSelection(query, projects)).toEqual({
      projectIds: undefined,
      query,
    });
  });

  it('does not lift a project condition when the query uses OR', () => {
    const query = 'project:seer OR span.op:db';
    expect(resolveSeerProjectSelection(query, projects)).toEqual({
      projectIds: undefined,
      query,
    });
  });

  it('lifts a top-level project filter alongside a parenthesized group', () => {
    // The project term is a top-level AND, not under an OR, so lifting is safe.
    expect(resolveSeerProjectSelection('project:seer (span.op:db)', projects)).toEqual({
      projectIds: [11],
      query: 'span.op:db',
    });
  });

  it('does not lift when the query contains an OR anywhere', () => {
    // Conservative: any OR skips the lift, even when it doesn't scope the project.
    const query = 'project:seer AND (span.op:a OR span.op:b)';
    expect(resolveSeerProjectSelection(query, projects)).toEqual({
      projectIds: undefined,
      query,
    });
  });

  it('falls back to expandedProjectIds when the query has no project filter', () => {
    expect(resolveSeerProjectSelection('span.op:db', projects, [5, 6])).toEqual({
      projectIds: [5, 6],
      query: 'span.op:db',
    });
  });

  it('returns undefined project ids when nothing is present', () => {
    expect(resolveSeerProjectSelection('span.op:db', projects)).toEqual({
      projectIds: undefined,
      query: 'span.op:db',
    });
  });
});

describe('generateQueryTokensString', () => {
  const projects = [
    ProjectFixture({id: '11', slug: 'seer'}),
    ProjectFixture({id: '22', slug: 'sentry'}),
  ];

  it('omits the projects clause when there is no project scope', () => {
    expect(generateQueryTokensString({query: 'is:unresolved'})).not.toContain('projects');
  });

  it('moves a resolved project filter out of the filter text and announces it', () => {
    const readable = generateQueryTokensString(
      {query: 'project:seer is:unresolved'},
      projects
    );
    expect(readable).not.toContain('project is seer');
    expect(readable).toContain("projects are 'seer'");
  });

  it('announces the expanded project scope for screen readers', () => {
    expect(
      generateQueryTokensString(
        {query: 'is:unresolved', expandedProjectIds: [11, 22]},
        projects
      )
    ).toContain("projects are 'seer, sentry'");
  });

  it('formats wildcard operators without private unicode markers', () => {
    expect(
      generateQueryTokensString({
        query: `browser.name:${WildcardOperators.CONTAINS}FireFox`,
      })
    ).toBe("Filter is 'browser.name contains FireFox '");
  });
});

describe('formatQueryToNaturalLanguage', () => {
  it.each([
    {
      query: `browser.name:${WildcardOperators.CONTAINS}FireFox`,
      expected: 'browser.name contains FireFox ',
    },
    {
      query: `url:${WildcardOperators.STARTS_WITH}/api`,
      expected: 'url starts with /api ',
    },
    {
      query: `path:${WildcardOperators.ENDS_WITH}.js`,
      expected: 'path ends with .js ',
    },
    {
      query: `!browser.name:${WildcardOperators.CONTAINS}FireFox`,
      expected: 'browser.name does not contain FireFox ',
    },
    {
      query: `!url:${WildcardOperators.STARTS_WITH}/api`,
      expected: 'url does not start with /api ',
    },
    {
      query: `!path:${WildcardOperators.ENDS_WITH}.js`,
      expected: 'path does not end with .js ',
    },
  ])('formats $query as $expected', ({query, expected}) => {
    expect(formatQueryToNaturalLanguage(query)).toBe(expected);
  });
});

// parseNaturalLanguageToQuery is the inverse of formatQueryToNaturalLanguage.
describe('parseNaturalLanguageToQuery', () => {
  it.each([
    ['is broken', 'is:broken'],
    ['count() > 100', 'count():>100'],
    ['count() < 100', 'count():<100'],
    ['count() >= 100', 'count():>=100'],
    ['count() <= 100', 'count():<=100'],
    ['count() is greater than or equal to 100', 'count():>=100'],
    ['count() is less than or equal to 5', 'count():<=5'],
    ['browser.name contains chrome', `browser.name:${WildcardOperators.CONTAINS}chrome`],
    ['browser.name starts with Chr', `browser.name:${WildcardOperators.STARTS_WITH}Chr`],
    ['browser.name ends with ome', `browser.name:${WildcardOperators.ENDS_WITH}ome`],
    [
      'browser.name does not contain chrome',
      `!browser.name:${WildcardOperators.CONTAINS}chrome`,
    ],
    [
      'browser.name does not start with Chr',
      `!browser.name:${WildcardOperators.STARTS_WITH}Chr`,
    ],
    [
      'browser.name does not end with ome',
      `!browser.name:${WildcardOperators.ENDS_WITH}ome`,
    ],
    [
      'event.type is error, browser.name contains chrome',
      `event.type:error browser.name:${WildcardOperators.CONTAINS}chrome`,
    ],
  ])('parses "%s" -> "%s"', (input, expected) => {
    expect(parseNaturalLanguageToQuery(input, isKey)).toBe(expected);
  });

  it.each([
    // no filter shape anywhere; prose `is` is not the status key
    'database connection timeout',
    'the build is broken',
    // free text before the first filter -> the whole input is prose
    'hello event.type is error',
    // a known key not followed by an operator phrase
    'browser.name chrome',
    // mid-typing a longer comparator phrase: must not fire the shorter prefix
    // ("is greater than") and consume "or" as the value -> count():>or
    'count() is greater than or equal',
  ])('returns null for "%s"', input => {
    expect(parseNaturalLanguageToQuery(input, isKey)).toBeNull();
  });

  it.each([
    'is:unresolved',
    '!is:resolved',
    'is:unresolved assigned:me',
    'is:unresolved something',
    'browser:chrome',
    '!browser:chrome',
    'count():>100',
    'count():>=100',
    'count():<100',
    'count():<=100',
    '!count():>2',
    'transaction.duration:>500',
    'release:"a big release"',
    'browser:[chrome, firefox]',
    'browser:[chrome,firefox]',
    // Wildcards now round-trip: parse emits the same TermOperator markers that
    // formatWildcardToken reads back.
    `browser.name:${WildcardOperators.CONTAINS}chrome`,
    `browser.name:${WildcardOperators.STARTS_WITH}Chr`,
    `browser.name:${WildcardOperators.ENDS_WITH}ome`,
    `!browser.name:${WildcardOperators.CONTAINS}chrome`,
    'event.type:error error.type:ApiError',
    'event.type:error error.type:ApiError OR browser:chrome AND code',
  ])('"%s" survives format -> parse', esq => {
    const humanized = formatQueryToNaturalLanguage(esq);
    expect(parseNaturalLanguageToQuery(humanized, isKey)).toBe(esq);
  });
});
