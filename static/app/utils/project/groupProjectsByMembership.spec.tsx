import {ProjectFixture} from 'sentry-fixture/project';

import {groupProjectsByMembership} from './groupProjectsByMembership';

function slugsByGroup(groups: ReturnType<typeof groupProjectsByMembership>) {
  return groups.map(group => [group.label, group.projects.map(project => project.slug)]);
}

describe('groupProjectsByMembership', () => {
  it('groups member projects before other projects, bookmarks first', () => {
    const groups = groupProjectsByMembership([
      ProjectFixture({id: '1', slug: 'zeta', isMember: true}),
      ProjectFixture({id: '2', slug: 'beta', isMember: false, isBookmarked: true}),
      ProjectFixture({id: '3', slug: 'alpha', isMember: false}),
      ProjectFixture({id: '4', slug: 'omega', isMember: true, isBookmarked: true}),
      ProjectFixture({id: '5', slug: 'gamma', isMember: true}),
    ]);

    expect(slugsByGroup(groups)).toEqual([
      ['My Projects', ['omega', 'gamma', 'zeta']],
      ['Other Projects', ['beta', 'alpha']],
    ]);
  });

  it('leaves out empty groups', () => {
    const groups = groupProjectsByMembership([
      ProjectFixture({id: '1', slug: 'javascript', isMember: true}),
    ]);

    expect(slugsByGroup(groups)).toEqual([['My Projects', ['javascript']]]);
    expect(groupProjectsByMembership([])).toEqual([]);
  });

  it('sorts by the given bookmarks instead of the current ones', () => {
    const groups = groupProjectsByMembership(
      [
        ProjectFixture({id: '1', slug: 'alpha', isMember: true, isBookmarked: true}),
        ProjectFixture({id: '2', slug: 'beta', isMember: true}),
      ],
      new Set(['2'])
    );

    expect(slugsByGroup(groups)).toEqual([['My Projects', ['beta', 'alpha']]]);
  });
});
