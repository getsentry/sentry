import {Fragment} from 'react';
import merge from 'lodash/merge';
import {GroupFixture} from 'sentry-fixture/group';
import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SearchFixture} from 'sentry-fixture/search';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GlobalModal} from '@sentry/scraps/modal';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TagStore} from 'sentry/stores/tagStore';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import * as parseLinkHeaderModule from 'sentry/utils/parseLinkHeader';
import IssueListOverview from 'sentry/views/issueList/overview';
import {
  DEFAULT_QUERY,
  getStoredIssueSort,
  IssueSortOptions,
  setStoredIssueSort,
} from 'sentry/views/issueList/utils';

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

const project = ProjectFixture({
  id: '3559',
  name: 'Foo Project',
  slug: 'project-slug',
  firstEvent: new Date().toISOString(),
});

const organization = OrganizationFixture({
  id: '1337',
  slug: 'org-slug',
  access: [],
});

const initialRouterConfig = {
  routes: [
    '/organizations/:orgId/issues/',
    '/organizations/:orgId/issues/searches/:searchId/',
    '/organizations/:orgId/issues/views/:viewId/',
  ],
  location: {
    pathname: '/organizations/org-slug/issues/',
    query: {},
  },
};

function getSearchInput() {
  const input = screen.getAllByRole('combobox', {name: 'Add a search term'}).at(-1);

  expect(input).toBeInTheDocument();

  return input!;
}

describe('IssueList', () => {
  const tags = TagsFixture();
  const group = GroupFixture({project});
  const groupStats = GroupStatsFixture();
  let fetchMembersRequest: jest.Mock;
  const parseLinkHeaderSpy = jest.spyOn(parseLinkHeaderModule, 'parseLinkHeader');

  beforeEach(() => {
    Object.defineProperty(Element.prototype, 'clientWidth', {value: 1000});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [group],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [groupStats],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      method: 'GET',
      body: [{}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [
        {
          project: 'test-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: tags,
    });
    fetchMembersRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [MemberFixture({projects: [project.slug]})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      method: 'GET',
      body: [MemberFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });

    TagStore.init?.();
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    localStorageWrapper.clear();
  });

  describe('withStores and feature flags', () => {
    let issuesRequest: jest.Mock;

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'GET',
        body: [],
      });
      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
    });

    it('loads group uses the provided initial query when no query is in the URL', async () => {
      render(<IssueListOverview initialQuery="is:unresolved" />, {
        organization,

        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {},
          },
        },
      });

      // Should display the initial query in the UI
      expect(
        await screen.findByRole('button', {name: 'Remove filter: is'})
      ).toBeInTheDocument();
      expect(screen.getByText('unresolved')).toBeInTheDocument();

      // Should make a request with the initial query
      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.stringContaining('query=is%3Aunresolved'),
          })
        );
      });

      expect(issuesRequest).toHaveBeenCalledTimes(1);
    });

    it('loads with a query in URL', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          SearchFixture({
            id: '123',
            name: 'Assigned to Me',
            isPinned: false,
            isGlobal: true,
            query: 'assigned:me',
            type: 0,
          }),
        ],
      });

      render(<IssueListOverview />, {
        organization,

        initialRouterConfig: merge({}, initialRouterConfig, {
          location: {
            query: {query: 'level:error'},
          },
        }),
      });

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            // Should be called with default query
            data: expect.stringContaining('level%3Aerror'),
          })
        );
      });

      expect(
        screen.getByRole('button', {name: 'Remove filter: level'})
      ).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
    });

    it('requests derived data when the issue inbox flag is enabled', async () => {
      render(<IssueListOverview />, {
        organization: OrganizationFixture({
          features: ['issue-inbox'],
        }),
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.stringContaining('expand=derivedData'),
          })
        );
      });
    });

    it('does not request derived data when the progress UI flag is disabled', async () => {
      render(<IssueListOverview />, {
        organization,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.not.stringContaining('expand=derivedData'),
          })
        );
      });
    });

    it('caches the search results', async () => {
      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: Array.from(Array.from({length: 25}), (_, i) =>
          GroupFixture({id: `${i}`, project})
        ),
        headers: {
          Link: DEFAULT_LINKS_HEADER,
          'X-Hits': '500',
          'X-Max-Hits': '1000',
        },
      });

      PageFiltersStore.onInitializeUrlState({
        projects: [],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });

      const {unmount} = render(<IssueListOverview />, {
        organization,

        initialRouterConfig,
      });

      expect(
        await screen.findByText(textWithMarkupMatcher('1-25 of 500'))
      ).toBeInTheDocument();
      expect(issuesRequest).toHaveBeenCalledTimes(1);
      unmount();

      // Mount component again, getting from cache
      render(<IssueListOverview />, {
        organization,

        initialRouterConfig,
      });

      expect(
        await screen.findByText(textWithMarkupMatcher('1-25 of 500'))
      ).toBeInTheDocument();
      expect(issuesRequest).toHaveBeenCalledTimes(1);
    }, 20_000);

    it('does not allow pagination to "previous" while on first page and resets cursors when navigating back to initial page', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const {router: testRouter} = render(<IssueListOverview />, {
        organization,

        initialRouterConfig,
      });

      expect(await screen.findByRole('button', {name: 'Previous'})).toBeDisabled();

      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="previous"; results="true"; cursor="1443575000:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443574000:0:0>; rel="next"; results="true"; cursor="1443574000:0:0"',
        },
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

      await waitFor(() => {
        expect(testRouter.location.query).toEqual({
          cursor: '1443575000:0:0',
          groupStatsPeriod: 'auto',
          page: '1',
          project: '3559',
          query: DEFAULT_QUERY,
          statsPeriod: '14d',
          referrer: 'issue-list',
        });
      });

      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
      });

      // Click next again
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));

      await waitFor(() => {
        expect(testRouter.location.query).toEqual({
          cursor: '1443574000:0:0',
          groupStatsPeriod: 'auto',
          page: '2',
          project: '3559',
          query: DEFAULT_QUERY,
          statsPeriod: '14d',
          referrer: 'issue-list',
        });
      });

      // Click previous
      await userEvent.click(screen.getByRole('button', {name: 'Previous'}));

      await waitFor(() => {
        expect(testRouter.location.query).toEqual({
          cursor: '1443575000:0:1',
          groupStatsPeriod: 'auto',
          page: '1',
          project: '3559',
          query: DEFAULT_QUERY,
          statsPeriod: '14d',
          referrer: 'issue-list',
        });
      });

      // Click previous back to initial page
      await userEvent.click(screen.getByRole('button', {name: 'Previous'}));

      await waitFor(() => {
        expect(testRouter.location.query.cursor).toBeUndefined();
      });
      expect(testRouter.location.query.page).toBeUndefined();
    });
  });

  it('opens the filter menu and restores keyboard focus when dismissed', async () => {
    render(<IssueListOverview />, {organization, initialRouterConfig});

    const filterButton = screen.getByRole('button', {name: 'Filter'});
    await userEvent.click(filterButton);

    expect(screen.getByRole('menu', {name: 'Filter'})).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('Date range')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu', {name: 'Filter'})).not.toBeInTheDocument();
    await waitFor(() => expect(filterButton).toHaveFocus());
    expect(screen.getByText('Ordered by Last Seen')).toBeInTheDocument();
    expect(getSearchInput()).toBeInTheDocument();
  });

  it('adds a filter from the picker and removes its chip', async () => {
    const {router} = render(<IssueListOverview />, {organization, initialRouterConfig});
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Status'}));
    await userEvent.click(await screen.findByRole('option', {name: 'resolved'}));
    await waitFor(() => expect(router.location.query.query).toContain('is:resolved'));
    await userEvent.keyboard('{Escape}{Escape}');
    await userEvent.click(screen.getByRole('button', {name: 'Remove filter: is'}));
    await userEvent.click(getSearchInput());
    await userEvent.keyboard('{enter}');
    await waitFor(() => expect(router.location.query.query).not.toContain('is:resolved'));
    expect(router.location.query.query).toContain('issue.priority:');
  });

  it('uses query-builder multi-select values in the assignee submenu', async () => {
    const {router} = render(<IssueListOverview />, {organization, initialRouterConfig});
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Assignee'}));
    const me = await screen.findByRole('checkbox', {name: 'Toggle me'});
    expect(router.location.query.query).toBeUndefined();
    await userEvent.click(me);
    await waitFor(() => expect(router.location.query.query).toContain('assigned:me'));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Toggle my_teams'}));
    await waitFor(() =>
      expect(router.location.query.query).toContain('assigned:[me,my_teams]')
    );
    expect(screen.getByRole('checkbox', {name: 'Toggle me'})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: 'Toggle my_teams'})).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Toggle me'}));
    await userEvent.click(screen.getByRole('checkbox', {name: 'Toggle my_teams'}));
    await waitFor(() => expect(router.location.query.query).not.toContain('assigned:'));
    expect(router.location.query.query).toContain('is:unresolved');
  });

  it('narrows submenu values without changing the issue query', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/level/values/',
      body: [
        {value: 'warning', count: 1},
        {value: 'error', count: 1},
      ],
    });
    const {router} = render(<IssueListOverview />, {organization, initialRouterConfig});
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    expect(screen.getByRole('menuitemradio', {name: 'Release'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Issue type'})).toBeInTheDocument();
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Level'}));
    const input = await screen.findByPlaceholderText('Filter values…');
    await userEvent.type(input, 'warn');
    expect(await screen.findByRole('option', {name: 'warning'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'error'})).not.toBeInTheDocument();
    expect(router.location.query.query).toBeUndefined();
    await userEvent.clear(input);
    await userEvent.type(input, 'arbitrary,value{Enter}');
    expect(router.location.query.query).toBeUndefined();
  });

  it('supports project search and staged selection in the submenu', async () => {
    const secondProject = ProjectFixture({
      id: '42',
      slug: 'another-project',
      isMember: false,
    });
    const {router} = render(<IssueListOverview />, {organization, initialRouterConfig});
    act(() =>
      ProjectsStore.loadInitialData([
        project,
        secondProject,
        ProjectFixture({id: '43', slug: 'third-project', isMember: false}),
      ])
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Projects'}));
    const menu = within(await screen.findByRole('dialog', {name: 'Projects'}));
    await userEvent.type(menu.getByPlaceholderText('Search…'), 'another');
    expect(menu.queryByRole('row', {name: 'project-slug'})).not.toBeInTheDocument();
    await userEvent.click(menu.getByRole('checkbox', {name: 'Select another-project'}));
    expect(router.location.query.project).not.toEqual(expect.arrayContaining(['42']));
    await userEvent.click(menu.getByRole('button', {name: 'Apply'}));
    await waitFor(() => expect(router.location.query.project).toContain('42'));
    expect(screen.queryByRole('dialog', {name: 'Projects'})).not.toBeInTheDocument();
  });

  it('supports environment search, cancel, and staged multi-selection in the submenu', async () => {
    const {router} = render(<IssueListOverview />, {organization, initialRouterConfig});
    act(() =>
      ProjectsStore.loadInitialData([{...project, environments: ['prod', 'staging']}])
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Environment'}));
    let menu = within(await screen.findByRole('dialog', {name: 'Environment'}));
    await userEvent.type(menu.getByPlaceholderText('Search…'), 'prod');
    expect(menu.queryByRole('row', {name: 'staging'})).not.toBeInTheDocument();
    await userEvent.click(menu.getByRole('checkbox', {name: 'Select prod'}));
    expect(router.location.query.environment).toBeUndefined();
    await userEvent.click(menu.getByRole('button', {name: 'Cancel'}));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: 'Environment'})).not.toBeInTheDocument()
    );
    expect(router.location.query.environment).toBeUndefined();
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Environment'}));
    menu = within(await screen.findByRole('dialog', {name: 'Environment'}));
    await userEvent.click(menu.getByRole('checkbox', {name: 'Select prod'}));
    await userEvent.click(menu.getByRole('checkbox', {name: 'Select staging'}));
    await userEvent.click(menu.getByRole('button', {name: 'Apply'}));
    await waitFor(() =>
      expect(router.location.query.environment).toEqual(['prod', 'staging'])
    );
  });

  it('supports project shortcuts and drops environments unavailable in the new scope', async () => {
    const {router} = render(<IssueListOverview />, {
      organization,
      initialRouterConfig: merge({}, initialRouterConfig, {
        location: {query: {environment: 'prod'}},
      }),
    });
    act(() =>
      ProjectsStore.loadInitialData([
        {...project, isMember: true, environments: ['prod']},
        ProjectFixture({
          id: '42',
          slug: 'another-project',
          isMember: false,
          environments: ['staging'],
        }),
      ])
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Projects'}));
    let menu = within(await screen.findByRole('dialog', {name: 'Projects'}));
    await userEvent.click(menu.getByRole('row', {name: 'another-project'}));
    await waitFor(() => expect(router.location.query.project).toBe('42'));
    expect(router.location.query.environment).toBeUndefined();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: 'Projects'})).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Projects'}));
    menu = within(await screen.findByRole('dialog', {name: 'Projects'}));
    await userEvent.keyboard('{Control>}');
    await userEvent.click(menu.getByRole('row', {name: 'All Projects'}));
    await userEvent.keyboard('{/Control}');
    await waitFor(() => expect(router.location.query.project).toBe('-1'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', {name: 'Projects'})).not.toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Projects'}));
    menu = within(await screen.findByRole('dialog', {name: 'Projects'}));
    await userEvent.click(menu.getByRole('row', {name: 'My Projects'}));
    await waitFor(() => expect(router.location.query.project).toBeUndefined());
  });

  it('enforces the project selection limit when narrowing All Projects', async () => {
    PageFiltersStore.onInitializeUrlState({
      projects: [-1],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });
    const {router} = render(<IssueListOverview />, {
      organization,
      initialRouterConfig: merge({}, initialRouterConfig, {
        location: {query: {project: '-1'}},
      }),
    });
    act(() =>
      ProjectsStore.loadInitialData(
        Array.from({length: 52}, (_, index) =>
          ProjectFixture({
            id: String(index + 1),
            slug: `project-${index + 1}`,
            isMember: false,
          })
        )
      )
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Projects'}));
    const menu = within(await screen.findByRole('dialog', {name: 'Projects'}));
    await userEvent.click(menu.getByRole('checkbox', {name: 'Select project-1'}));
    expect(menu.getByRole('button', {name: 'Apply'})).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(router.location.query.project).toBe('-1');
  });

  it('applies advanced filters only when submitted', async () => {
    const {router} = render(
      <Fragment>
        <IssueListOverview />
        <GlobalModal />
      </Fragment>,
      {
        organization,
        initialRouterConfig,
      }
    );
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Advanced filter'}));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText('Advanced filter')).toBeInTheDocument();
    await userEvent.click(dialog.getByRole('button', {name: 'Remove filter: is'}));
    expect(router.location.query.query).toBeUndefined();
    await userEvent.click(dialog.getByRole('button', {name: 'Apply filters'}));
    await waitFor(() => expect(router.location.query.query).toBeDefined());
    expect(router.location.query.query).not.toContain('is:unresolved');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('preserves an existing filter operator when editing submenu values', async () => {
    const {router} = render(<IssueListOverview />, {
      organization,
      initialRouterConfig: merge({}, initialRouterConfig, {
        location: {query: {query: '!assigned:me level:error'}},
      }),
    });
    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Assignee'}));
    expect(await screen.findByRole('checkbox', {name: 'Toggle me'})).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', {name: 'Toggle my_teams'}));
    await waitFor(() =>
      expect(router.location.query.query).toBe('!assigned:[me,my_teams] level:error')
    );
  });

  it('hides display properties in the feed and restores defaults', async () => {
    render(<IssueListOverview />, {organization, initialRouterConfig});
    const table = within(screen.getByTestId('issue-list'));
    expect(table.getByText('Events')).toBeInTheDocument();
    expect(
      await table.findByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Display Options'}));
    await userEvent.click(screen.getByRole('button', {name: 'Events', pressed: true}));
    expect(table.queryByText('Events')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Events', pressed: false})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Assignee', pressed: true}));
    expect(table.queryByText('Assignee')).not.toBeInTheDocument();
    expect(
      table.queryByRole('button', {name: 'Modify issue assignee'})
    ).not.toBeInTheDocument();
    await waitFor(() => {
      const stored = JSON.parse(
        localStorageWrapper.getItem('issues-display-columns:org-slug')!
      );
      expect(stored).not.toContain('event');
    });
    await userEvent.click(screen.getByRole('button', {name: 'Reset display properties'}));
    expect(table.getByText('Events')).toBeInTheDocument();
    expect(
      table.getByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
  });

  describe('sort persistence', () => {
    it('does not persist sort to localStorage without the recommended-sort feature', async () => {
      render(<IssueListOverview />, {organization, initialRouterConfig});

      await userEvent.click(screen.getByRole('button', {name: 'Display Options'}));
      await userEvent.click(await screen.findByRole('button', {name: 'Last Seen'}));
      await userEvent.click(
        within(screen.getByRole('listbox', {name: 'Last Seen'})).getByRole('option', {
          name: 'Events',
        })
      );

      expect(screen.getByText('Ordered by Events')).toBeInTheDocument();

      // Writing while the feature is off would leave a stale value that overrides
      // the Recommended default once the flag is enabled.
      expect(getStoredIssueSort(organization.slug)).toBeNull();
    });

    it('persists sort to localStorage with the recommended-sort-default feature', async () => {
      const featureOrg = OrganizationFixture({
        ...organization,
        features: ['issue-stream-recommended-sort-default'],
      });
      render(<IssueListOverview />, {organization: featureOrg, initialRouterConfig});

      await userEvent.click(screen.getByRole('button', {name: 'Display Options'}));
      await userEvent.click(await screen.findByRole('button', {name: /Recommended/}));
      await userEvent.click(
        within(screen.getByRole('listbox', {name: /Recommended/})).getByRole('option', {
          name: 'Events',
        })
      );

      expect(getStoredIssueSort(featureOrg.slug)).toBe(IssueSortOptions.FREQ);
    });

    it('does not read or write the stored sort on a view page', async () => {
      const featureOrg = OrganizationFixture({
        ...organization,
        features: ['issue-stream-recommended-sort-default'],
      });
      setStoredIssueSort(featureOrg.slug, IssueSortOptions.FREQ);
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/1/',
        body: GroupSearchViewFixture({querySort: IssueSortOptions.DATE}),
      });

      render(<IssueListOverview />, {
        organization: featureOrg,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            pathname: '/organizations/org-slug/issues/views/1/',
          },
        },
      });

      // The view's saved sort applies, not the stored feed sort
      await userEvent.click(screen.getByRole('button', {name: 'Display Options'}));
      await userEvent.click(await screen.findByRole('button', {name: 'Last Seen'}));
      await userEvent.click(
        within(screen.getByRole('listbox', {name: 'Last Seen'})).getByRole('option', {
          name: 'Users',
        })
      );

      // Changing the sort within a view does not overwrite the feed's stored sort
      expect(getStoredIssueSort(featureOrg.slug)).toBe(IssueSortOptions.FREQ);
    });
  });

  describe('transitionTo', () => {
    it('pushes to history when query is updated', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const {router: testRouter} = render(<IssueListOverview />, {
        initialRouterConfig,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));
      await userEvent.click(getSearchInput());
      await userEvent.paste('is:ignored');
      await userEvent.keyboard('{enter}');

      await waitFor(() => {
        expect(testRouter.location.query).toEqual({
          groupStatsPeriod: 'auto',
          project: project.id.toString(),
          query: 'is:ignored',
          statsPeriod: '14d',
          referrer: 'issue-list',
        });
      });
    });
  });

  it('fetches members', async () => {
    render(<IssueListOverview />, {
      initialRouterConfig,
    });

    await waitFor(() => {
      expect(fetchMembersRequest).toHaveBeenCalled();
    });
  });

  it('renders assignees for projects with Object prototype key slugs', async () => {
    const constructorProject = ProjectFixture({
      id: '999',
      slug: 'constructor',
      name: 'Constructor',
      firstEvent: new Date().toISOString(),
    });
    const constructorGroup = GroupFixture({project: constructorProject});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [constructorGroup],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [MemberFixture({projects: [constructorProject.slug]})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [constructorProject],
    });

    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(constructorProject.id, 10)],
      environments: [],
      datetime: {period: '14d', start: null, end: null, utc: null},
    });

    render(<IssueListOverview />, {
      organization,
      initialRouterConfig,
    });

    expect(await screen.findByText(constructorGroup.shortId)).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
  });

  describe('componentDidUpdate fetching groups', () => {
    let fetchDataMock: jest.Mock;

    beforeEach(() => {
      fetchDataMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
    });

    it('fetches data on selection change', async () => {
      const {rerender} = render(<IssueListOverview />, {
        initialRouterConfig,
      });

      act(() =>
        PageFiltersStore.onInitializeUrlState({
          projects: [99],
          environments: [],
          datetime: {period: '24h', start: null, end: null, utc: null},
        })
      );

      rerender(<IssueListOverview />);

      await waitFor(() => {
        expect(fetchDataMock).toHaveBeenCalled();
      });
    });

    it('uses correct statsPeriod when fetching issues list and no datetime given', async () => {
      const {rerender} = render(<IssueListOverview />, {
        initialRouterConfig: merge({}, initialRouterConfig, {
          location: {
            query: {
              query: DEFAULT_QUERY,
            },
          },
        }),
      });

      act(() =>
        PageFiltersStore.onInitializeUrlState({
          projects: [99],
          environments: [],
          datetime: {period: '14d', start: null, end: null, utc: null},
        })
      );

      rerender(<IssueListOverview />);

      await waitFor(() => {
        expect(fetchDataMock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/issues/',
          expect.objectContaining({
            data: 'collapse=stats&collapse=unhandled&expand=owners&expand=inbox&groupStatsPeriod=auto&limit=25&project=99&query=is%3Aunresolved%20issue.priority%3A%5Bhigh%2C%20medium%5D&shortIdLookup=1&statsPeriod=14d',
          })
        );
      });
    });

    it('defaults the row graph period to auto so it follows the global time range', async () => {
      const {rerender} = render(<IssueListOverview />, {
        initialRouterConfig: merge({}, initialRouterConfig, {
          location: {
            query: {
              query: DEFAULT_QUERY,
            },
          },
        }),
      });

      act(() =>
        PageFiltersStore.onInitializeUrlState({
          projects: [99],
          environments: [],
          datetime: {period: '14d', start: null, end: null, utc: null},
        })
      );

      rerender(<IssueListOverview />);

      await waitFor(() => {
        expect(fetchDataMock).toHaveBeenNthCalledWith(
          2,
          '/organizations/org-slug/issues/',
          expect.objectContaining({
            data: 'collapse=stats&collapse=unhandled&expand=owners&expand=inbox&groupStatsPeriod=auto&limit=25&project=99&query=is%3Aunresolved%20issue.priority%3A%5Bhigh%2C%20medium%5D&shortIdLookup=1&statsPeriod=14d',
          })
        );
      });
    });
  });

  describe('componentDidUpdate fetching members', () => {
    it('fetches memberlist on project change', async () => {
      const {rerender} = render(<IssueListOverview />, {
        initialRouterConfig,
      });
      // Called during componentDidMount
      await waitFor(() => {
        expect(fetchMembersRequest).toHaveBeenCalled();
      });

      act(() =>
        PageFiltersStore.onInitializeUrlState({
          projects: [99],
          environments: [],
          datetime: {period: '24h', start: null, end: null, utc: null},
        })
      );
      rerender(<IssueListOverview />);

      await waitFor(() => {
        expect(fetchMembersRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: {
              project: ['99'],
            },
          })
        );
      });
    });
  });

  describe('render states', () => {
    it('displays an error when issues fail to load', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        status: 500,
        statusCode: 500,
      });
      render(<IssueListOverview />, {
        initialRouterConfig,
      });

      expect(await screen.findByTestId('loading-error')).toBeInTheDocument();
    });

    it('displays "Get out there and write some broken code" with default query', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
      render(<IssueListOverview />, {
        initialRouterConfig,
      });

      expect(
        await screen.findByText(/Get out there and write some broken code!/i)
      ).toBeInTheDocument();
    });

    it('displays "no issues match your search" with a non-default query', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const {router: testRouter} = render(<IssueListOverview />, {
        initialRouterConfig: merge({}, initialRouterConfig, {
          location: {
            query: {
              query: DEFAULT_QUERY,
            },
          },
        }),
      });

      await screen.findByRole('grid', {name: 'Create a search query'});
      await userEvent.click(getSearchInput());
      await userEvent.keyboard('foo{enter}');

      await waitFor(() => {
        expect(testRouter.location.query.query).toBe(
          'is:unresolved issue.priority:[high, medium] foo'
        );
      });

      expect(await screen.findByText(/No issues match your search/i)).toBeInTheDocument();
    });

    it('sets statsLoading to false when fetchStats returns early with empty groupIds', async () => {
      // Start with some groups to trigger stats loading
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const statsRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues-stats/',
        body: [groupStats],
        asyncDelay: 5000,
      });

      render(<IssueListOverview />, {
        organization,
        initialRouterConfig,
      });

      // Verify stats request was made
      await waitFor(() => {
        expect(statsRequest).toHaveBeenCalled();
      });

      // Now simulate a query that returns empty results
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      // Trigger a new search that returns empty results
      await userEvent.click(getSearchInput());
      await userEvent.keyboard('void{enter}');

      // Wait for the empty state to appear (not loading skeleton)
      await waitFor(() => {
        expect(screen.getByText(/No issues match your search/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Robot', () => {
    beforeEach(() => {
      PageFiltersStore.onInitializeUrlState({
        projects: [],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      });
    });

    const createWrapper = async (moreProps: any) => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      render(<IssueListOverview {...moreProps} />, {
        organization,

        initialRouterConfig,
      });

      await waitFor(() => {
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
      });
    };

    it('displays when no projects selected and all projects user is member of, async does not have first event', async () => {
      const projectsBody = [
        ProjectFixture({
          id: '1',
          slug: 'foo',
          isMember: true,
          firstEvent: null,
        }),
        ProjectFixture({
          id: '2',
          slug: 'bar',
          isMember: true,
          firstEvent: null,
        }),
        ProjectFixture({
          id: '3',
          slug: 'baz',
          isMember: true,
          firstEvent: null,
        }),
      ];
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/sent-first-event/',
        query: {
          is_member: true,
        },
        body: {sentFirstEvent: false},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projectsBody,
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/foo/issues/',
        body: [],
      });

      await createWrapper({
        organization: OrganizationFixture(),
      });

      expect(
        await screen.findByRole('heading', {name: /waiting for events/i})
      ).toBeInTheDocument();
    });

    it('does not display when no projects selected and any projects have a first event', async () => {
      const projectsBody = [
        ProjectFixture({
          id: '1',
          slug: 'foo',
          isMember: true,
          firstEvent: null,
        }),
        ProjectFixture({
          id: '2',
          slug: 'bar',
          isMember: true,
          firstEvent: new Date().toISOString(),
        }),
        ProjectFixture({
          id: '3',
          slug: 'baz',
          isMember: true,
          firstEvent: null,
        }),
      ];
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/sent-first-event/',
        query: {
          is_member: true,
        },
        body: {sentFirstEvent: true},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projectsBody,
      });
      await createWrapper({
        organization: OrganizationFixture(),
      });

      expect(
        screen.queryByRole('heading', {name: /waiting for events/i})
      ).not.toBeInTheDocument();
    });

    it('displays when all selected projects do not have first event', async () => {
      const projectsBody = [
        ProjectFixture({
          id: '1',
          slug: 'foo',
          isMember: true,
          firstEvent: null,
        }),
        ProjectFixture({
          id: '2',
          slug: 'bar',
          isMember: true,
          firstEvent: null,
        }),
        ProjectFixture({
          id: '3',
          slug: 'baz',
          isMember: true,
          firstEvent: null,
        }),
      ];
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/sent-first-event/',
        query: {
          project: [1, 2],
        },
        body: {sentFirstEvent: false},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projectsBody,
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/foo/issues/',
        body: [],
      });

      await createWrapper({
        selection: {
          projects: [1, 2],
          environments: [],
          datetime: {period: '14d'},
        },
        organization: OrganizationFixture(),
      });

      expect(
        await screen.findByRole('heading', {name: /waiting for events/i})
      ).toBeInTheDocument();
    });

    it('does not display when any selected projects have first event', async () => {
      const projectsBody = [
        ProjectFixture({
          id: '1',
          slug: 'foo',
          isMember: true,
          firstEvent: null,
        }),
        ProjectFixture({
          id: '2',
          slug: 'bar',
          isMember: true,
          firstEvent: new Date().toISOString(),
        }),
        ProjectFixture({
          id: '3',
          slug: 'baz',
          isMember: true,
          firstEvent: new Date().toISOString(),
        }),
      ];
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/sent-first-event/',
        query: {
          project: [1, 2],
        },
        body: {sentFirstEvent: true},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: projectsBody,
      });

      await createWrapper({
        selection: {
          projects: [1, 2],
          environments: [],
          datetime: {period: '14d'},
        },
        organization: OrganizationFixture(),
      });

      expect(
        screen.queryByRole('heading', {name: /waiting for events/i})
      ).not.toBeInTheDocument();
    });
  });

  it('displays a count that represents the current page', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: Array.from(Array.from({length: 25}), (_, i) =>
        GroupFixture({id: `${i}`, project})
      ),
      headers: {
        Link: DEFAULT_LINKS_HEADER,
        'X-Hits': '500',
        'X-Max-Hits': '1000',
      },
    });

    parseLinkHeaderSpy.mockReturnValue({
      next: {
        results: true,
        cursor: '',
        href: '',
      },
      previous: {
        results: false,
        cursor: '',
        href: '',
      },
    });

    const {rerender} = render(<IssueListOverview />, {
      organization,

      initialRouterConfig: merge({}, initialRouterConfig, {
        location: {
          query: {
            cursor: 'some cursor',
            page: 1,
          },
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText(textWithMarkupMatcher('1-25 of 500'))).toBeInTheDocument();
    });

    parseLinkHeaderSpy.mockReturnValue({
      next: {
        results: true,
        cursor: '',
        href: '',
      },
      previous: {
        results: true,
        cursor: '',
        href: '',
      },
    });
    rerender(<IssueListOverview />);

    await waitFor(() => {
      expect(screen.getByText(textWithMarkupMatcher('26-50 of 500'))).toBeInTheDocument();
    });
  }, 20_000);

  describe('project low trends queue alert', () => {
    beforeEach(() => {
      act(() => ProjectsStore.reset());
    });

    it('does not render event processing alert', async () => {
      act(() => ProjectsStore.loadInitialData([project]));

      render(<IssueListOverview />, {
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(screen.queryByText(/event processing/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('new view page', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/1/',
        body: GroupSearchViewFixture(),
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
    });

    it('displays empty state when first loaded', async () => {
      const fetchDataMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const {router: testRouter} = render(
        <IssueListOverview initialQuery="" shouldFetchOnMount={false} />,
        {
          initialRouterConfig: {
            ...initialRouterConfig,
            location: {
              ...initialRouterConfig.location,
              pathname: '/organizations/org-slug/issues/views/1/',
              query: {new: 'true'},
            },
          },
        }
      );

      await screen.findByText('Suggested Queries');
      expect(fetchDataMock).not.toHaveBeenCalled();

      const highVolumeIssuesQuery = screen.getByRole('button', {
        name: 'High Volume Issues is:unresolved timesSeen:>100',
      });

      // Clicking query should add it, remove suggested queries, and search issues
      await userEvent.click(highVolumeIssuesQuery);
      await waitFor(() => {
        expect(testRouter.location.query.query).toBe('is:unresolved timesSeen:>100');
      });
      // ?new=true should be removed
      expect(testRouter.location.query.new).toBeUndefined();

      expect(fetchDataMock).toHaveBeenCalled();
      expect(screen.queryByText('Suggested Queries')).not.toBeInTheDocument();
    });
  });
});
