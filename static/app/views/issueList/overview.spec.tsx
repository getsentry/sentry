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
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import localStorageWrapper from 'sentry/utils/localStorage';
import * as parseLinkHeader from 'sentry/utils/parseLinkHeader';
import IssueListOverview from 'sentry/views/issueList/overview';
import {DEFAULT_QUERY} from 'sentry/views/issueList/utils';

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
  const parseLinkHeaderSpy = jest.spyOn(parseLinkHeader, 'default');

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
      expect(await screen.findByRole('row', {name: 'is:unresolved'})).toBeInTheDocument();

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

      expect(screen.getByRole('row', {name: 'level:error'})).toBeInTheDocument();
    });

    it('caches the search results', async () => {
      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [...new Array(25)].map((_, i) => GroupFixture({id: `${i}`, project})),
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
            data: 'collapse=stats&collapse=unhandled&expand=owners&expand=inbox&limit=25&project=99&query=is%3Aunresolved%20issue.priority%3A%5Bhigh%2C%20medium%5D&shortIdLookup=1&statsPeriod=14d',
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

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
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

      expect(await screen.findByTestId('awaiting-events')).toBeInTheDocument();
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

      expect(screen.queryByTestId('awaiting-events')).not.toBeInTheDocument();
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

      expect(await screen.findByTestId('awaiting-events')).toBeInTheDocument();
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

      expect(screen.queryByTestId('awaiting-events')).not.toBeInTheDocument();
    });
  });

  it('displays a count that represents the current page', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [...new Array(25)].map((_, i) => GroupFixture({id: `${i}`, project})),
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
