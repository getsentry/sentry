import {createRef} from 'react';
import {browserHistory} from 'react-router';
import * as qs from 'query-string';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'app/components/stream/group';
import TagStore from 'app/stores/tagStore';
import IssueListActions from 'app/views/issueList/actions';
import IssueListWithStores, {IssueListOverview} from 'app/views/issueList/overview';

// Taken from https://stackoverflow.com/a/56859650/1015027
const withMarkup = query => text =>
  query((_content, node) => {
    const hasText = n => n.textContent === text;
    const childrenDontHaveText = Array.from(node.children).every(
      child => !hasText(child)
    );
    return hasText(node) && childrenDontHaveText;
  });

// Mock <IssueListSidebar> and <IssueListActions>
jest.mock('app/views/issueList/sidebar', () => jest.fn(() => null));
jest.mock('app/views/issueList/actions', () => jest.fn(() => null));
jest.mock('app/components/stream/group', () => jest.fn(() => null));
jest.mock('app/views/issueList/noGroupsHandler/congratsRobots', () =>
  jest.fn(() => null)
);

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

describe('IssueList', function () {
  /**  @type {ReturnType<typeof mountWithTheme>} */
  let wrapper;

  let project;
  let group;
  let groupStats;
  let savedSearch;

  let fetchTagsRequest;
  let fetchMembersRequest;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    project = TestStubs.ProjectDetails({
      id: '3559',
      name: 'Foo Project',
      slug: 'project-slug',
      firstEvent: true,
    });

    savedSearch = TestStubs.Search({
      id: '789',
      query: 'is:unresolved TypeError',
      sort: 'date',
      name: 'Unresolved TypeErrors',
      projectId: project.id,
    });

    group = TestStubs.Group({project});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [group],
      headers: {
        Link: DEFAULT_LINKS_HEADER,
      },
    });
    groupStats = TestStubs.GroupStats();
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
    const tags = TestStubs.Tags();
    fetchTagsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: tags,
    });
    fetchMembersRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [TestStubs.Member({projects: [project.slug]})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });

    TagStore.init();
  });

  afterEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  describe('withStores and feature flags', function () {
    const {router, routerContext} = initializeOrg({
      organization: {
        features: ['global-views'],
        slug: 'org-slug',
      },
      router: {
        location: {query: {}, search: ''},
        params: {orgId: 'org-slug'},
      },
    });
    const defaultProps = {};
    let savedSearchesRequest;
    let recentSearchesRequest;
    let issuesRequest;

    /* helpers */
    const createWrapper = ({params, location, ...p} = {}) => {
      const newRouter = {
        ...router,
        params: {
          ...router.params,
          ...params,
        },
        location: {
          ...router.location,
          ...location,
        },
      };

      wrapper = mountWithTheme(
        <IssueListWithStores {...newRouter} {...defaultProps} {...p} />,
        {context: routerContext}
      );
    };

    beforeEach(function () {
      StreamGroup.mockClear();

      recentSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'GET',
        body: [],
      });
      savedSearchesRequest = MockApiClient.addMockResponse({
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

    it('loads group rows with default query (no pinned queries, and no query in URL)', async function () {
      createWrapper();

      // Loading saved searches
      expect(savedSearchesRequest).toHaveBeenCalledTimes(1);

      await wrapper.findByDisplayValue('is:unresolved');

      // Saved search not active since is:unresolved is a tab
      const savedSearches = await wrapper.findAllByText('Saved Searches');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      // auxillary requests being made
      expect(recentSearchesRequest).toHaveBeenCalledTimes(1);
      expect(fetchTagsRequest).toHaveBeenCalledTimes(1);
      expect(fetchMembersRequest).toHaveBeenCalledTimes(1);

      // primary /issues/ request
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('is%3Aunresolved'),
        })
      );

      // This is mocked
      expect(StreamGroup).toHaveBeenCalled();
    });

    it('loads with query in URL and pinned queries', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          TestStubs.Search({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            query: 'is:resolved',
          }),
        ],
      });

      createWrapper({
        location: {
          query: {
            query: 'level:foo',
          },
        },
      });

      await wrapper.findByDisplayValue('level:foo');

      // Custom search
      const savedSearches = await wrapper.findAllByText('Custom Search');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      // Main /issues/ request
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('level%3Afoo'),
        })
      );
    });

    it('loads with a pinned saved query', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          TestStubs.Search({
            id: '123',
            name: 'Org Custom',
            isPinned: true,
            isGlobal: false,
            isOrgCustom: true,
            query: 'is:resolved',
          }),
        ],
      });
      createWrapper();

      await wrapper.findByDisplayValue('is:resolved');

      const savedSearches = await wrapper.findAllByText('Org Custom');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('is%3Aresolved'),
        })
      );
    });

    it('loads with a pinned custom query', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          TestStubs.Search({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            isGlobal: false,
            isOrgCustom: false,
            query: 'is:resolved',
          }),
        ],
      });
      createWrapper();

      await wrapper.findByDisplayValue('is:resolved');

      // Organization saved search selector should have default saved search selected
      const savedSearches = await wrapper.findAllByText('My Pinned Search');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('is%3Aresolved'),
        })
      );
    });

    it('loads with a saved query', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          TestStubs.Search({
            id: '123',
            name: 'Assigned to Me',
            isPinned: false,
            isGlobal: true,
            query: 'assigned:me',
            sort: 'priority',
            projectId: null,
            type: 0,
          }),
        ],
      });
      createWrapper({params: {searchId: '123'}});

      await wrapper.findByDisplayValue('assigned:me');

      const savedSearches = await wrapper.findAllByText('Assigned to Me');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data:
            expect.stringContaining('assigned%3Ame') &&
            expect.stringContaining('sort=priority'),
        })
      );
    });

    it('loads with a query in URL', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          TestStubs.Search({
            id: '123',
            name: 'Assigned to Me',
            isPinned: false,
            isGlobal: true,
            query: 'assigned:me',
            projectId: null,
            type: 0,
          }),
        ],
      });
      createWrapper({location: {query: {query: 'level:error'}}});

      await wrapper.findByDisplayValue('level:error');

      // Custom search
      const savedSearches = await wrapper.findAllByText('Custom Search');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('level%3Aerror'),
        })
      );
    });

    it('loads with an empty query in URL', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          TestStubs.Search({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            isGlobal: false,
            isOrgCustom: false,
            query: 'is:resolved',
          }),
        ],
      });
      createWrapper({location: {query: {query: undefined}}});

      await wrapper.findByDisplayValue('is:resolved');

      const savedSearches = await wrapper.findAllByText('My Pinned Search');
      expect(savedSearches).toHaveLength(1);
      expect(savedSearches[0]).toBeInTheDocument();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with empty query
          data: expect.stringContaining(''),
        })
      );
    });

    it('selects a saved search', async function () {
      const localSavedSearch = {...savedSearch, projectId: null};
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });
      createWrapper();

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      fireEvent.click(wrapper.getByTestId('saved-search-title'));
      fireEvent.click(wrapper.getByText('Unresolved TypeErrors'));

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
        })
      );
    });

    it('changes sort for a saved search', async function () {
      const localSavedSearch = {...savedSearch, projectId: null};
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });
      createWrapper({
        savedSearch: localSavedSearch,
        location: {
          ...router.location,
          pathname: '/organizations/org-slug/issues/searches/789/',
          query: {
            environment: [],
            project: [],
          },
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      fireEvent.click(wrapper.getByText('Sort by'));
      fireEvent.click(wrapper.getByText('Events'));

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
          query: {
            environment: [],
            project: [],
            sort: 'freq',
            statsPeriod: '14d',
          },
        })
      );
    });

    it('clears a saved search when a custom one is entered', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          TestStubs.Search({
            id: '123',
            name: 'Pinned search',
            isPinned: true,
            isGlobal: false,
            isOrgCustom: true,
            query: 'is:resolved',
          }),
        ],
      });
      createWrapper();

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      // Update the search textarea
      fireEvent.change(
        wrapper.getByPlaceholderText('Search for events, users, tags, and more'),
        {target: {value: 'dogs'}}
      );
      // Submit the form
      fireEvent.submit(wrapper.getByTestId('search-form'));
      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/',
          query: {
            environment: [],
            project: [],
            query: 'dogs',
            statsPeriod: '14d',
          },
        })
      );
    });

    it('pins and unpins a custom query', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });
      createWrapper({
        location: {
          ...router.location,
          query: {
            query: 'assigned:me level:fatal',
          },
        },
        params: {
          ...router.params,
          searchId: '666',
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
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
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      fireEvent.change(
        wrapper.getByPlaceholderText('Search for events, users, tags, and more'),
        {target: {value: 'assigned:me level:fatal'}}
      );
      fireEvent.submit(wrapper.getByTestId('search-form'));

      expect(browserHistory.push.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'assigned:me level:fatal',
          }),
        })
      );

      expect(wrapper.getByTestId('saved-search-title')).toHaveTextContent(
        'Custom Search'
      );

      fireEvent.click(wrapper.getByLabelText('Pin this search'));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
      });

      fireEvent.click(wrapper.getByLabelText('Unpin this search'));

      await waitFor(() => {
        expect(deletePin).toHaveBeenCalled();
      });
    });

    it('pins and unpins a saved query', async function () {
      const assignedToMe = TestStubs.Search({
        id: '234',
        name: 'Assigned to Me',
        isPinned: false,
        isGlobal: true,
        query: 'assigned:me',
        sort: 'date',
        projectId: null,
        type: 0,
      });
      const createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...savedSearch,
          isPinned: true,
        },
      });
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch, assignedToMe],
      });
      createWrapper({
        location: {
          ...router.location,
          query: {
            query: 'assigned:me level:fatal',
          },
        },
        params: {
          ...router.params,
          searchId: '789',
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      fireEvent.click(wrapper.getByTestId('saved-search-title'));
      fireEvent.click(wrapper.getAllByText('Unresolved TypeErrors')[1]);

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
          query: {
            environment: [],
            project: ['3559'],
            statsPeriod: '14d',
            sort: 'date',
          },
        })
      );

      expect(wrapper.getByTestId('saved-search-title')).toHaveTextContent(
        'Unresolved TypeErrors'
      );

      fireEvent.click(wrapper.getByLabelText('Pin this search'));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
      });

      fireEvent.click(wrapper.getByLabelText('Unpin this search'));

      await waitFor(() => {
        expect(deletePin).toHaveBeenCalled();
      });
    });

    it('does not allow pagination to "previous" while on first page', async function () {
      createWrapper();

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      expect(wrapper.getByLabelText('Previous').getAttribute('aria-disabled')).toEqual(
        'true'
      );

      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="previous"; results="true"; cursor="1443575000:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443574000:0:0>; rel="next"; results="true"; cursor="1443574000:0:0"',
        },
      });

      fireEvent.click(wrapper.getByLabelText('Next'));

      expect(browserHistory.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443575000:0:0',
          page: 1,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
        },
      });
    });

    it('resets cursors when navigating back to initial page', async function () {
      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="previous"; results="true"; cursor="1443575000:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443574000:0:0>; rel="next"; results="true"; cursor="1443574000:0:0"',
        },
      });

      createWrapper({
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443575000:0:1',
          page: 1,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      fireEvent.click(wrapper.getByLabelText('Previous'));

      // cursor is undefined because "prev" cursor is === initial "next" cursor
      expect(browserHistory.push).toHaveBeenLastCalledWith({
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: undefined,
          environment: [],
          page: undefined,
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
        },
      });
    });

    it('displays a count that represents the current page', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [...Array(25)].map((_, idx) => TestStubs.Group({id: `${idx}`, project})),
        headers: {
          'X-Hits': 500,
          'X-Max-Hits': 1000,
          Link: DEFAULT_LINKS_HEADER,
        },
      });
      createWrapper();

      const getByTextWithMarkup = withMarkup(wrapper.findByText);
      expect(await getByTextWithMarkup('Showing 25 of 500 issues')).toBeInTheDocument();
    });

    it('displays a 2nd page count that represents the current page', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [...Array(25)].map((_, idx) => TestStubs.Group({id: `${idx}`, project})),
        headers: {
          'X-Hits': 500,
          'X-Max-Hits': 1000,
          Link: DEFAULT_LINKS_HEADER.replace('results="false"', 'results="true"'),
        },
      });
      createWrapper({
        location: {
          query: {page: 1, cursor: 'some cursor'},
        },
      });

      const getByTextWithMarkup = withMarkup(wrapper.findByText);
      expect(await getByTextWithMarkup('Showing 50 of 500 issues')).toBeInTheDocument();
    });

    it('displays a count based on items removed', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [...Array(25)].map((_, idx) =>
          TestStubs.Group({
            id: `${idx}`,
            project,
            inbox: {
              date_added: '2020-11-24T13:17:42.248751Z',
              reason: 3,
              reason_details: {},
            },
          })
        ),
        headers: {
          'X-Hits': 500,
          'X-Max-Hits': 1000,
          Link: DEFAULT_LINKS_HEADER,
        },
      });
      createWrapper({
        location: {
          query: {
            cursor: 'some cursor',
            page: 1,
            query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
          },
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      // actions are mocked out
      IssueListActions.mock.calls[0][0].onMarkReviewed(['1']);

      const getByTextWithMarkup = withMarkup(wrapper.findByText);
      expect(await getByTextWithMarkup('Showing 24 of 499 issues')).toBeInTheDocument();
    });

    it('fetches and displays processing issues', async function () {
      createWrapper();

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      expect(
        await wrapper.findByText('There is 1 issue blocking event processing')
      ).toBeInTheDocument();
    });

    it('displays an error', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        statusCode: 500,
      });
      createWrapper();

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      expect(await wrapper.findByText('Unknown API Error')).toBeInTheDocument();
    });

    it('displays congrats robots animation with only is:unresolved query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      createWrapper({
        location: {
          query: {
            query: 'is:unresolved',
          },
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      expect(wrapper.getByTestId('congrats-robot')).toBeInTheDocument();
    });

    it('displays an empty resultset with is:unresolved and level:error query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      createWrapper({
        location: {
          query: {
            query: 'is:unresolved TypeError',
          },
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      expect(wrapper.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('displays an empty resultset with has:browser query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      createWrapper({
        location: {
          query: {
            query: 'with has:browser',
          },
        },
      });

      await waitFor(() => {
        expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
      });

      expect(wrapper.getByTestId('empty-state')).toBeInTheDocument();
    });

    describe('Error Robot', function () {
      beforeEach(() => {
        MockApiClient.addMockResponse({
          url: '/organizations/org-slug/issues/',
          body: [],
          headers: {
            Link: DEFAULT_LINKS_HEADER,
          },
        });
      });
      it('displays when no projects selected and all projects user is member of, does not have first event', async function () {
        const projects = [
          TestStubs.Project({
            id: '1',
            slug: 'foo',
            isMember: true,
            firstEvent: false,
          }),
          TestStubs.Project({
            id: '2',
            slug: 'bar',
            isMember: true,
            firstEvent: false,
          }),
          TestStubs.Project({
            id: '3',
            slug: 'baz',
            isMember: true,
            firstEvent: false,
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
          body: projects,
        });
        MockApiClient.addMockResponse({
          url: '/projects/org-slug/foo/issues/',
          body: [],
        });
        createWrapper({
          organization: TestStubs.Organization({
            projects,
          }),
        });

        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(await wrapper.findByText('Waiting for events…')).toBeInTheDocument();
      });

      it('does not display when no projects selected and any projects have a first event', async function () {
        const projects = [
          TestStubs.Project({
            id: '1',
            slug: 'foo',
            isMember: true,
            firstEvent: false,
          }),
          TestStubs.Project({
            id: '2',
            slug: 'bar',
            isMember: true,
            firstEvent: true,
          }),
          TestStubs.Project({
            id: '3',
            slug: 'baz',
            isMember: true,
            firstEvent: false,
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
          body: projects,
        });
        wrapper = createWrapper({
          organization: TestStubs.Organization({
            projects,
          }),
        });
        createWrapper({
          organization: TestStubs.Organization({
            projects,
          }),
        });

        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(wrapper.queryByTestId('awaiting-events')).not.toBeInTheDocument();
      });

      it('displays when all selected projects do not have first event', async function () {
        const projects = [
          TestStubs.Project({
            id: '1',
            slug: 'foo',
            isMember: true,
            firstEvent: false,
          }),
          TestStubs.Project({
            id: '2',
            slug: 'bar',
            isMember: true,
            firstEvent: false,
          }),
          TestStubs.Project({
            id: '3',
            slug: 'baz',
            isMember: true,
            firstEvent: false,
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
          body: projects,
        });
        MockApiClient.addMockResponse({
          url: '/projects/org-slug/foo/issues/',
          body: [],
        });

        createWrapper({
          selection: {
            projects: [1, 2],
            environments: [],
            datetime: {period: '14d'},
          },
          organization: TestStubs.Organization({
            projects,
          }),
        });

        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(await wrapper.findByText('Waiting for events…')).toBeInTheDocument();
      });

      it('does not display when any selected projects have first event', async function () {
        const projects = [
          TestStubs.Project({
            id: '1',
            slug: 'foo',
            isMember: true,
            firstEvent: false,
          }),
          TestStubs.Project({
            id: '2',
            slug: 'bar',
            isMember: true,
            firstEvent: true,
          }),
          TestStubs.Project({
            id: '3',
            slug: 'baz',
            isMember: true,
            firstEvent: true,
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
          body: projects,
        });

        createWrapper({
          selection: {
            projects: [1, 2],
            environments: [],
            datetime: {period: '14d'},
          },
          organization: TestStubs.Organization({
            projects,
          }),
        });

        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(wrapper.queryByTestId('awaiting-events')).not.toBeInTheDocument();
      });
    });

    describe('getEndpointParams', function () {
      const defaultQueryParams = {
        collapse: 'stats',
        expand: ['owners', 'inbox'],
        limit: '25',
        query: 'is:unresolved',
        shortIdLookup: '1',
        statsPeriod: '14d',
      };

      it('omits null values', async function () {
        createWrapper({
          selection: {
            projects: null,
            environments: null,
            datetime: {period: '14d'},
          },
        });

        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(issuesRequest).toHaveBeenCalledTimes(1);
        expect(qs.parse(issuesRequest.mock.calls[0][1].data)).toEqual(defaultQueryParams);
      });

      it('omits defaults', async function () {
        createWrapper({
          location: {
            query: {
              sort: 'date',
              groupStatsPeriod: '24h',
            },
          },
        });
        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(issuesRequest).toHaveBeenCalledTimes(1);
        expect(qs.parse(issuesRequest.mock.calls[0][1].data)).toEqual(defaultQueryParams);
      });

      it('uses saved search data', async function () {
        createWrapper({
          savedSearch,
          selection: {
            project: [savedSearch.projectId],
            projects: null,
            environments: null,
            datetime: {period: '14d'},
          },
        });
        await waitFor(() => {
          expect(wrapper.queryByTestId('loading-indicator')).toBe(null);
        });

        expect(issuesRequest).toHaveBeenCalledTimes(1);
        expect(qs.parse(issuesRequest.mock.calls[0][1].data)).toEqual({
          ...defaultQueryParams,
          query: 'is:unresolved TypeError',
        });
      });
    });
  });

  describe('transitionTo', function () {
    let instance;
    let selection;
    beforeEach(function () {
      selection = TestStubs.GlobalSelection({datetime: {}});
      const {router, routerContext, organization} = initializeOrg({
        organization: {
          features: ['global-views'],
          slug: 'org-slug',
        },
        router: {
          location: {query: {}, search: ''},
          params: {orgId: 'org-slug'},
        },
      });
      const ref = createRef();
      wrapper = mountWithTheme(
        <IssueListOverview
          {...router}
          api={new MockApiClient()}
          selection={selection}
          organization={organization}
          ref={ref}
        />,
        {
          context: routerContext,
        }
      );
      instance = ref.current;
    });

    it('transitions to query updates', function () {
      instance.transitionTo({query: 'is:ignored'});

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/',
        query: {
          environment: selection.environments,
          project: selection.projects,
          query: 'is:ignored',
        },
      });
    });

    it('transitions to cursor with project-less saved search', function () {
      savedSearch = {
        id: 123,
        projectId: null,
        query: 'foo:bar',
      };
      instance.transitionTo({cursor: '1554756114000:0:0'}, savedSearch);

      // should keep the current project selection as we're going to the next page.
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/123/',
        query: {
          environment: selection.environments,
          project: selection.projects,
          cursor: '1554756114000:0:0',
        },
      });
    });

    it('transitions to cursor with project saved search', function () {
      savedSearch = {
        id: 123,
        projectId: 999,
        query: 'foo:bar',
      };
      instance.transitionTo({cursor: '1554756114000:0:0'}, savedSearch);

      // should keep the current project selection as we're going to the next page.
      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/123/',
        query: {
          environment: selection.environments,
          project: selection.projects,
          cursor: '1554756114000:0:0',
        },
      });
    });

    it('transitions to saved search that has a projectId', function () {
      savedSearch = {
        id: 123,
        projectId: 99,
        query: 'foo:bar',
      };
      instance.transitionTo(undefined, savedSearch);

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/123/',
        query: {
          environment: selection.environments,
          project: [savedSearch.projectId],
        },
      });
    });

    it('transitions to saved search with a sort', function () {
      savedSearch = {
        id: 123,
        project: null,
        query: 'foo:bar',
        sort: 'freq',
      };
      instance.transitionTo(undefined, savedSearch);

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/123/',
        query: {
          environment: selection.environments,
          project: selection.projects,
          sort: savedSearch.sort,
        },
      });
    });
  });
});
