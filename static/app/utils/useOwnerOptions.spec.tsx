import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useOwnerOptions} from './useOwnerOptions';

describe('useOwnerOptions', () => {
  const mockUsers = [UserFixture()];
  const mockTeams = [TeamFixture()];

  it('includes members and teams', () => {
    const {result} = renderHook(useOwnerOptions, {
      initialProps: {
        teams: mockTeams,
        members: mockUsers,
      },
    });

    expect(result.current).toEqual([
      {
        label: 'My Teams',
        options: [
          {
            label: '#team-slug',
            value: 'team:1',
            leadingItems: expect.anything(),
          },
        ],
      },
      {
        label: 'Members',
        options: [
          {
            label: 'Foo Bar',
            value: 'user:1',
            leadingItems: expect.anything(),
          },
        ],
      },
      {label: 'Other Teams', options: []},
      {label: 'Disabled Teams', options: []},
    ]);
  });

  it('separates my teams and other teams', () => {
    const teams = [
      TeamFixture(),
      TeamFixture({id: '2', slug: 'other-team', isMember: false}),
    ];

    const {result} = renderHook(useOwnerOptions, {
      initialProps: {teams},
    });

    expect(result.current).toEqual([
      {
        label: 'My Teams',
        options: [
          {
            label: '#team-slug',
            value: 'team:1',
            leadingItems: expect.anything(),
          },
        ],
      },
      {
        label: 'Members',
        options: [],
      },
      {
        label: 'Other Teams',
        options: [
          {
            label: '#other-team',
            value: 'team:2',
            leadingItems: expect.anything(),
          },
        ],
      },
      {label: 'Disabled Teams', options: []},
    ]);
  });

  it('disables teams not associated with the projects', () => {
    const project1 = ProjectFixture();
    const project2 = ProjectFixture({id: '2', slug: 'other-project'});
    const teamWithProject1 = TeamFixture({projects: [project1], slug: 'my-team'});
    const teamWithProject2 = TeamFixture({
      id: '2',
      projects: [project2],
      slug: 'other-team',
      isMember: false,
    });
    const teamWithoutProject = TeamFixture({id: '3', slug: 'disabled-team'});
    const teams = [teamWithProject1, teamWithProject2, teamWithoutProject];

    const {result} = renderHook(useOwnerOptions, {
      initialProps: {
        memberOfProjectSlugs: [project1.slug, project2.slug],
        teams,
      },
    });

    expect(result.current).toEqual([
      {
        label: 'My Teams',
        options: [
          {
            label: '#my-team',
            value: 'team:1',
            leadingItems: expect.anything(),
          },
        ],
      },
      {
        label: 'Members',
        options: [],
      },
      {
        label: 'Other Teams',
        options: [
          {
            label: '#other-team',
            value: 'team:2',
            leadingItems: expect.anything(),
          },
        ],
      },
      {
        label: 'Disabled Teams',
        options: [
          {
            label: '#disabled-team',
            value: 'team:3',
            leadingItems: expect.anything(),
            disabled: true,
            tooltip: '#disabled-team is not a member of the selected projects',
            tooltipOptions: {position: 'left'},
          },
        ],
      },
    ]);
  });
});
