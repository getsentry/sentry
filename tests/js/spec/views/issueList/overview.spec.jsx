import {createRef} from 'react';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  cleanup,
  fireEvent,
  mountWithTheme,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import StreamGroup from 'app/components/stream/group';
import TagStore from 'app/stores/tagStore';
import IssueListWithStores, {IssueListOverview} from 'app/views/issueList/overview';

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
    cleanup();
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();

    for (const el of document.querySelectorAll('style').values()) {
      el.remove();
    }
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
    const getSavedSearchTitle = w =>
      w.queryByTestId('saved-search-title')?.textContent.trim();

    const getSearchBarValue = w =>
      w
        .queryByPlaceholderText('Search for events, users, tags, and more')
        ?.textContent.trim();

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('is:unresolved'));

      // Saved search not active since is:unresolved is a tab
      expect(getSavedSearchTitle(wrapper)).toBe('Saved Searches');

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('level:foo'));

      // Custom search
      expect(getSavedSearchTitle(wrapper)).toBe('Custom Search');

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('is:resolved'));

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Org Custom');

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('is:resolved'));

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('My Pinned Search');

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('assigned:me'));

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Assigned to Me');

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('level:error'));

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Custom Search');

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

      await waitFor(() => expect(getSearchBarValue(wrapper)).toBe('is:resolved'));

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('My Pinned Search');

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
