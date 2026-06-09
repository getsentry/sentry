import {generateQueryTokensString, getExpandedProjectIds} from './utils';

describe('getExpandedProjectIds', () => {
  it('returns undefined when no projects are returned', () => {
    expect(getExpandedProjectIds(null, [1, 2])).toBeUndefined();
    expect(getExpandedProjectIds(undefined, [1, 2])).toBeUndefined();
    expect(getExpandedProjectIds([], [1, 2])).toBeUndefined();
  });

  it('returns undefined when the returned scope does not exceed the selection', () => {
    expect(getExpandedProjectIds([1, 2], [1, 2])).toBeUndefined();
    // The selection already covers everything returned -> no expansion.
    expect(getExpandedProjectIds([1], [1, 2])).toBeUndefined();
  });

  it('returns the full returned scope when it includes unselected projects', () => {
    expect(getExpandedProjectIds([1, 2, 3], [1, 2])).toEqual([1, 2, 3]);
    expect(getExpandedProjectIds([5], [])).toEqual([5]);
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
