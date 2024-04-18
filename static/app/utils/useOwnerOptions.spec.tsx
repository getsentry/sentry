import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {QueryClientProvider} from 'sentry/utils/queryClient';

import {useOwnerOptions} from './useOwnerOptions';

describe('useOwnerOptions', () => {
  const org = OrganizationFixture();
  const mockUsers = [UserFixture()];
  const mockTeams = [TeamFixture()];

  const queryClient = makeTestQueryClient();

  function Wrapper({children}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  beforeEach(() => {
    MemberListStore.init();
    MemberListStore.loadInitialData(mockUsers);
    TeamStore.init();
    TeamStore.loadInitialData(mockTeams);
    OrganizationStore.onUpdate(org, {replace: true});

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/user-teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: [],
    });
  });

  it('includes members and teams', async () => {
    const {result} = renderHook(useOwnerOptions, {
      wrapper: Wrapper,
      initialProps: {},
    });

    await waitFor(() => !result.current.fetching);

    expect(result.current.options).toEqual([
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
      {label: 'Other Teams', options: []},
      {label: 'Disabled Teams', options: []},
    ]);
  });

  it('separates my teams and other teams', async () => {
    TeamStore.init();
    TeamStore.loadInitialData([
      TeamFixture(),
      TeamFixture({id: '2', slug: 'other-team', isMember: false}),
    ]);

    const {result} = renderHook(useOwnerOptions, {
      wrapper: Wrapper,
      initialProps: {},
    });

    await waitFor(() => !result.current.fetching);

    expect(result.current.options).toEqual([
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

  it('disables teams not associated with the projects', async () => {
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
    TeamStore.init();
    TeamStore.loadInitialData([teamWithProject1, teamWithProject2, teamWithoutProject]);

    const {result} = renderHook(useOwnerOptions, {
      wrapper: Wrapper,
      initialProps: {
        memberOfProjectSlugs: [project1.slug, project2.slug],
      },
    });

    await waitFor(() => !result.current.fetching);

    expect(result.current.options).toEqual([
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
