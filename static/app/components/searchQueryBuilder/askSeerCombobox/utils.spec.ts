import {ProjectFixture} from 'sentry-fixture/project';

import {
  generateQueryTokensString,
  getExpandedProjectIds,
  resolveSeerProjectSelection,
} from './utils';

describe('getExpandedProjectIds', () => {
  it.each([null, undefined, []])('returns undefined when projects is %s', input => {
    expect(getExpandedProjectIds(input, [1, 2])).toBeUndefined();
  });

  it.each([
    {returned: [1, 2], selected: [1, 2]},
    {returned: [1], selected: [1, 2]},
  ])(
    'returns undefined when returned $returned does not exceed selection $selected',
    ({returned, selected}) => {
      expect(getExpandedProjectIds(returned, selected)).toBeUndefined();
    }
  );

  it.each([
    {returned: [1, 2, 3], selected: [1, 2], expected: [1, 2, 3]},
    {returned: [5], selected: [], expected: [5]},
  ])(
    'returns $returned when it includes projects beyond the selection',
    ({returned, selected, expected}) => {
      expect(getExpandedProjectIds(returned, selected)).toEqual(expected);
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
  it('omits the projects clause when there is no expansion', () => {
    expect(generateQueryTokensString({query: 'is:unresolved'})).not.toContain('expanded');
  });

  it('announces the expanded project scope for screen readers', () => {
    expect(
      generateQueryTokensString({query: 'is:unresolved', expandedProjectIds: [1, 2, 3]})
    ).toContain('search expanded to 3 projects');
  });

  it('uses the singular form for a single expanded project', () => {
    expect(generateQueryTokensString({expandedProjectIds: [1]})).toBe(
      'search expanded to 1 project'
    );
  });
});
