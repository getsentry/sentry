import {generateQueryTokensString, getExpandedProjectIds} from './utils';

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
