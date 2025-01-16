import merge from 'lodash/merge';
import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {SearchFixture} from 'sentry-fixture/search';
import {TagsFixture} from 'sentry-fixture/tags';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import StreamGroup from 'sentry/components/stream/group';
import {DEFAULT_QUERY} from 'sentry/constants';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import {SavedSearchVisibility} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import localStorageWrapper from 'sentry/utils/localStorage';
import * as parseLinkHeader from 'sentry/utils/parseLinkHeader';
import IssueListWithStores, {
  IssueListOverviewFc as IssueListOverview,
} from 'sentry/views/issueList/overviewFc';

// Mock <IssueListActions>
jest.mock('sentry/views/issueList/actions', () => jest.fn(() => null));
jest.mock('sentry/components/stream/group', () => jest.fn(() => null));

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

const project = ProjectFixture({
  id: '3559',
  name: 'Foo Project',
  slug: 'project-slug',
  firstEvent: new Date().toISOString(),
});

const {organization, projects, router} = initializeOrg({
  organization: {
    id: '1337',
    slug: 'org-slug',
    features: ['global-views'],
    access: [],
  },
  router: {
    location: {query: {query: DEFAULT_QUERY}},
    params: {},
  },
  projects: [project],
});

const routerProps = {
  params: router.params,
  location: router.location,
} as RouteComponentProps<{}, {searchId?: string}>;

const initialRouterConfig = {
  routes: [
    '/organizations/:orgId/issues/',
    '/organizations/:orgId/issues/searches/:searchId/',
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

describe('IssueList', function () {
  const tags = TagsFixture();
  const group = GroupFixture({project});
  const groupStats = GroupStatsFixture();
  const savedSearch = SearchFixture({
    id: '789',
    query: 'is:unresolved TypeError',
    sort: 'date',
    name: 'Unresolved TypeErrors',
  });

  let fetchMembersRequest: jest.Mock;
  const parseLinkHeaderSpy = jest.spyOn(parseLinkHeader, 'default');

  beforeEach(function () {
    // The tests fail because we have a "component update was not wrapped in act" error.
    // It should be safe to ignore this error, but we should remove the mock once we move to react testing library

    jest.spyOn(console, 'error').mockImplementation(jest.fn());
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
      url: '/organizations/org-slug/searches/',
      body: [savedSearch],
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

    PageFiltersStore.onInitializeUrlState(
      {
        projects: [parseInt(projects[0]!.id, 10)],
        environments: [],
        datetime: {period: '14d', start: null, end: null, utc: null},
      },
      new Set()
    );

    TagStore.init?.();
  });

  afterEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    localStorageWrapper.clear();
  });

  describe('withStores and feature flags', function () {
    let issuesRequest: jest.Mock;

    beforeEach(function () {
      jest.mocked(StreamGroup).mockClear();

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });
      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
    });

    it('loads group rows with default query (no pinned queries, async and no query in URL)', async function () {
      render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {},
          },
        },
      });

      await screen.findByRole('grid', {name: 'Create a search query'});
      expect(screen.getByRole('row', {name: 'is:unresolved'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: /custom search/i})).toBeInTheDocument();

      // primary /issues/ request
      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            // Should not be called with a "query" param, endpoint will find the default query itself
            data: expect.not.stringContaining('query'),
          })
        );
      });

      expect(issuesRequest).toHaveBeenCalledTimes(1);
    });

    it('loads with query in URL and pinned queries', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          SearchFixture({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            query: 'is:resolved',
          }),
        ],
      });

      render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {query: 'level:foo'},
          },
        },
      });

      await waitFor(() => {
        // Main /issues/ request
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            // Should be called with default query
            data: expect.stringContaining('level%3Afoo'),
          })
        );
      });

      expect(screen.getByRole('row', {name: 'level:foo'})).toBeInTheDocument();

      // Tab shows "custom search"
      expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();
    });

    it('loads with a saved query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          SearchFixture({
            id: '123',
            name: 'Assigned to Me',
            isPinned: false,
            isGlobal: true,
            query: 'assigned:me',
            sort: 'trends',
            type: 0,
          }),
        ],
      });

      render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            pathname: '/organizations/org-slug/issues/searches/123/',
          },
        },
      });

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: expect.stringContaining('searchId=123'),
          })
        );
      });

      expect(screen.getByRole('row', {name: 'assigned:me'})).toBeInTheDocument();

      // Organization saved search selector should have default saved search selected
      expect(screen.getByRole('button', {name: 'Assigned to Me'})).toBeInTheDocument();
    });

    it('loads with a query in URL', async function () {
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

      render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
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

      // Organization saved search selector should have default saved search selected
      expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();
    });

    it('loads with an empty query in URL', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          SearchFixture({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            isGlobal: false,
            query: 'is:resolved',
          }),
        ],
      });

      render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            ...initialRouterConfig.location,
            query: {},
          },
        },
      });

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            // Should be called with empty query
            data: expect.stringContaining(''),
          })
        );
      });

      expect(screen.getByRole('row', {name: 'is:resolved'})).toBeInTheDocument();

      // Organization saved search selector should have default saved search selected
      expect(screen.getByRole('button', {name: 'My Default Search'})).toBeInTheDocument();
    });

    it('caches the search results', async function () {
      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [...new Array(25)].map((_, i) => ({id: i})),
        headers: {
          Link: DEFAULT_LINKS_HEADER,
          'X-Hits': '500',
          'X-Max-Hits': '1000',
        },
      });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [],
          environments: [],
          datetime: {period: '14d', start: null, end: null, utc: null},
        },
        new Set()
      );

      const {unmount} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig,
      });

      expect(
        await screen.findByText(textWithMarkupMatcher('1-25 of 500'))
      ).toBeInTheDocument();
      expect(issuesRequest).toHaveBeenCalledTimes(1);
      unmount();

      // Mount component again, getting from cache
      render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig,
      });

      expect(
        await screen.findByText(textWithMarkupMatcher('1-25 of 500'))
      ).toBeInTheDocument();
      expect(issuesRequest).toHaveBeenCalledTimes(1);
    });

    it('1 search', async function () {
      const localSavedSearch = {...savedSearch, projectId: null};
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });

      const {router: testRouter} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig,
      });

      await userEvent.click(await screen.findByRole('button', {name: /custom search/i}));
      await userEvent.click(screen.getByRole('button', {name: localSavedSearch.name}));

      await waitFor(() => {
        expect(testRouter.location.pathname).toBe(
          '/organizations/org-slug/issues/searches/789/'
        );
      });
    });

    it('clears a saved search when a custom one is entered', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          SearchFixture({
            id: '123',
            name: 'Pinned search',
            isPinned: true,
            isGlobal: false,
            query: 'is:resolved',
          }),
        ],
      });

      const {router: testRouter} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig,
      });

      await screen.findByRole('grid', {name: 'Create a search query'});
      await userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));
      await userEvent.click(getSearchInput());
      await userEvent.keyboard('dogs{Enter}');

      await waitFor(() => {
        expect(testRouter.location.pathname).toBe('/organizations/org-slug/issues/');
      });

      expect(testRouter.location.query).toEqual(
        expect.objectContaining({
          project: '3559',
          referrer: 'issue-list',
          sort: '',
          query: 'dogs',
          statsPeriod: '14d',
        })
      );
    });

    it('pins a custom query', async function () {
      const pinnedSearch = {
        id: '666',
        name: 'My Pinned Search',
        query: 'assigned:me level:fatal',
        sort: 'date',
        isPinned: true,
        visibility: SavedSearchVisibility.ORGANIZATION,
      };
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });

      const {router: testRouter} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig,
      });

      await screen.findByRole('grid', {name: 'Create a search query'});
      await userEvent.click(screen.getByRole('button', {name: 'Clear search query'}));
      await userEvent.click(getSearchInput());
      await userEvent.paste('assigned:me level:fatal');
      await userEvent.keyboard('{Enter}');

      await waitFor(() => {
        expect(testRouter.location.query.query).toBe('assigned:me level:fatal');
      });

      expect(
        await screen.findByRole('button', {name: 'Custom Search'})
      ).toBeInTheDocument();

      MockApiClient.clearMockResponses();
      const createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: pinnedSearch,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch, pinnedSearch],
      });
      await userEvent.click(screen.getByLabelText(/Set as Default/i));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(testRouter.location.pathname).toBe(
          '/organizations/org-slug/issues/searches/666/'
        );
      });

      expect(testRouter.location.query.referrer).toBe('search-bar');
    });

    it('unpins a custom query', async function () {
      const pinnedSearch = SearchFixture({
        id: '666',
        name: 'My Pinned Search',
        query: 'assigned:me level:fatal',
        sort: 'date',
        isPinned: true,
        visibility: SavedSearchVisibility.ORGANIZATION,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [pinnedSearch],
      });
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      const routerWithSavedSearch = RouterFixture({
        params: {searchId: pinnedSearch.id},
      });

      render(<IssueListWithStores {...merge({}, routerProps, routerWithSavedSearch)} />, {
        router: routerWithSavedSearch,
        organization,
      });

      expect(
        await screen.findByRole('button', {name: 'My Default Search'})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText(/Remove Default/i));

      await waitFor(() => {
        expect(deletePin).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(routerWithSavedSearch.replace).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/issues/',
          })
        );
      });
    });

    it('pins a saved query', async function () {
      const assignedToMe = SearchFixture({
        id: '234',
        name: 'Assigned to Me',
        isPinned: false,
        isGlobal: true,
        query: 'assigned:me',
        sort: 'date',
        type: 0,
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch, assignedToMe],
      });

      const createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...savedSearch,
          isPinned: true,
        },
      });
      const routerWithSavedSearch = RouterFixture({params: {searchId: '789'}});

      render(<IssueListWithStores {...merge({}, routerProps, routerWithSavedSearch)} />, {
        router: routerWithSavedSearch,
        organization,
      });

      expect(
        await screen.findByRole('button', {name: savedSearch.name})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText(/set as default/i));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
      });

      expect(routerWithSavedSearch.replace).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
        })
      );
    });

    it('pinning search should keep project selected', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [123],
          environments: ['prod'],
          datetime: {
            period: null,
            start: null,
            end: null,
            utc: null,
          },
        },
        new Set()
      );

      const {router: testRouter} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig: merge({}, initialRouterConfig, {
          location: {
            query: {
              project: '123',
              environment: 'prod',
              query: 'assigned:me level:fatal',
            },
          },
        }),
      });

      const createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...savedSearch,
          id: '666',
          name: 'My Pinned Search',
          query: 'assigned:me level:fatal',
          sort: 'date',
          isPinned: true,
        },
      });

      await userEvent.click(await screen.findByLabelText(/set as default/i));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(testRouter.location.pathname).toBe(
          '/organizations/org-slug/issues/searches/666/'
        );
      });

      expect(testRouter.location.query).toEqual(
        expect.objectContaining({
          project: '123',
          environment: 'prod',
          query: 'assigned:me level:fatal',
        })
      );
    });

    it('unpinning search should keep project selected', async function () {
      const localSavedSearch = {
        ...savedSearch,
        id: '666',
        isPinned: true,
        query: 'assigned:me level:fatal',
      };
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [123],
          environments: ['prod'],
          datetime: {
            period: null,
            start: null,
            end: null,
            utc: null,
          },
        },
        new Set()
      );

      const {router: testRouter} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig: {
          ...initialRouterConfig,
          location: {
            pathname: '/organizations/org-slug/issues/searches/666/',
            query: {
              project: '123',
              environment: 'prod',
              query: 'assigned:me level:fatal',
            },
          },
        },
      });

      await userEvent.click(await screen.findByLabelText(/Remove Default/i));

      await waitFor(() => {
        expect(deletePin).toHaveBeenCalled();
      });

      expect(testRouter.location.pathname).toBe('/organizations/org-slug/issues/');
      expect(testRouter.location.query).toEqual(
        expect.objectContaining({
          project: '123',
          environment: 'prod',
          query: 'assigned:me level:fatal',
        })
      );
    });

    it('does not allow pagination to "previous" while on first page and resets cursors when navigating back to initial page', async function () {
      const {router: testRouter} = render(<IssueListWithStores {...routerProps} />, {
        organization,
        disableRouterMocks: true,
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

  describe('transitionTo', function () {
    it('pushes to history when query is updated', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const {router: testRouter} = render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
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

  it('fetches members', async function () {
    render(<IssueListOverview {...routerProps} />, {
      disableRouterMocks: true,
      initialRouterConfig,
    });

    await waitFor(() => {
      expect(fetchMembersRequest).toHaveBeenCalled();
    });
  });

  describe('componentDidUpdate fetching groups', function () {
    let fetchDataMock: jest.Mock;

    beforeEach(function () {
      fetchDataMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
      fetchDataMock.mockReset();
    });

    it('fetches data on selection change', async function () {
      const {rerender} = render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig,
      });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [99],
          environments: [],
          datetime: {period: '24h', start: null, end: null, utc: null},
        },
        new Set()
      );

      rerender(<IssueListOverview {...routerProps} />);

      await waitFor(() => {
        expect(fetchDataMock).toHaveBeenCalled();
      });
    });

    it('fetches data on savedSearch change', async function () {
      const {rerender} = render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig,
      });

      rerender(<IssueListOverview {...routerProps} />);

      await waitFor(() => {
        expect(fetchDataMock).toHaveBeenCalled();
      });
    });

    it('uses correct statsPeriod when fetching issues list and no datetime given', async function () {
      const {rerender} = render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig: merge({}, initialRouterConfig, {
          location: {
            query: {
              query: DEFAULT_QUERY,
            },
          },
        }),
      });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [99],
          environments: [],
          datetime: {period: '14d', start: null, end: null, utc: null},
        },
        new Set()
      );

      rerender(<IssueListOverview {...routerProps} />);

      await waitFor(() => {
        expect(fetchDataMock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/issues/',
          expect.objectContaining({
            data: 'collapse=stats&collapse=unhandled&expand=owners&expand=inbox&limit=25&project=99&query=is%3Aunresolved%20issue.priority%3A%5Bhigh%2C%20medium%5D&savedSearch=0&shortIdLookup=1&statsPeriod=14d',
          })
        );
      });
    });
  });

  describe('componentDidUpdate fetching members', function () {
    it('fetches memberlist on project change', async function () {
      const {rerender} = render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig,
      });
      // Called during componentDidMount
      await waitFor(() => {
        expect(fetchMembersRequest).toHaveBeenCalled();
      });

      PageFiltersStore.onInitializeUrlState(
        {
          projects: [99],
          environments: [],
          datetime: {period: '24h', start: null, end: null, utc: null},
        },
        new Set()
      );
      rerender(<IssueListOverview {...routerProps} />);

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

  describe('render states', function () {
    it('displays an error when issues fail to load', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        status: 500,
        statusCode: 500,
      });
      render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig,
      });

      expect(await screen.findByTestId('loading-error')).toBeInTheDocument();
    });

    it('displays "Get out there and write some broken code" with default query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
      render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig,
      });

      expect(
        await screen.findByText(/Get out there and write some broken code!/i)
      ).toBeInTheDocument();
    });

    it('displays "no issues match your search" with a non-default query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const {router: testRouter} = render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
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
  });

  describe('Error Robot', function () {
    beforeEach(() => {
      PageFiltersStore.onInitializeUrlState(
        {
          projects: [],
          environments: [],
          datetime: {period: '14d', start: null, end: null, utc: null},
        },
        new Set()
      );
    });

    const createWrapper = async (moreProps: any) => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      render(<IssueListOverview {...routerProps} {...moreProps} />, {
        organization,
        disableRouterMocks: true,
        initialRouterConfig,
      });

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    };

    it('displays when no projects selected and all projects user is member of, async does not have first event', async function () {
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

    it('does not display when no projects selected and any projects have a first event', async function () {
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

    it('displays when all selected projects do not have first event', async function () {
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

    it('does not display when any selected projects have first event', async function () {
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

  it('displays a count that represents the current page', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [...new Array(25)].map((_, i) => ({id: i})),
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

    const {rerender} = render(<IssueListOverview {...routerProps} />, {
      organization,
      disableRouterMocks: true,
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
    rerender(<IssueListOverview {...routerProps} />);

    await waitFor(() => {
      expect(screen.getByText(textWithMarkupMatcher('26-50 of 500'))).toBeInTheDocument();
    });
  });

  describe('project low trends queue alert', function () {
    beforeEach(function () {
      act(() => ProjectsStore.reset());
    });

    it('does not render event processing alert', async function () {
      act(() => ProjectsStore.loadInitialData([project]));

      render(<IssueListOverview {...routerProps} />, {
        disableRouterMocks: true,
        initialRouterConfig,
      });

      await waitFor(() => {
        expect(screen.queryByText(/event processing/i)).not.toBeInTheDocument();
      });
    });

    describe('renders alert', function () {
      it('for one project', async function () {
        act(() =>
          ProjectsStore.loadInitialData([
            {...project, eventProcessing: {symbolicationDegraded: true}},
          ])
        );

        render(<IssueListOverview {...routerProps} />, {
          organization,
          disableRouterMocks: true,
          initialRouterConfig,
        });

        await waitFor(() => {
          expect(
            screen.getByText(/Event Processing for this project is currently degraded/i)
          ).toBeInTheDocument();
        });
      });

      it('for multiple projects', async function () {
        const projectBar = ProjectFixture({
          id: '3560',
          name: 'Bar Project',
          slug: 'project-slug-bar',
        });

        act(() =>
          ProjectsStore.loadInitialData([
            {
              ...project,
              slug: 'project-slug',
              eventProcessing: {symbolicationDegraded: true},
            },
            {
              ...projectBar,
              slug: 'project-slug-bar',
              eventProcessing: {symbolicationDegraded: true},
            },
          ])
        );

        PageFiltersStore.onInitializeUrlState(
          {
            projects: [Number(project.id), Number(projectBar.id)],
            environments: [],
            datetime: {period: '14d', start: null, end: null, utc: null},
          },
          new Set()
        );

        render(<IssueListOverview {...routerProps} />, {
          organization,
          disableRouterMocks: true,
          initialRouterConfig,
        });

        await waitFor(() => {
          expect(
            screen.getByText(
              textWithMarkupMatcher(
                'Event Processing for the project-slug, project-slug-bar projects is currently degraded.'
              )
            )
          ).toBeInTheDocument();
        });
      });
    });
  });
});
