import {browserHistory} from 'react-router';
import merge from 'lodash/merge';
import {Group as GroupFixture} from 'sentry-fixture/group';
import {GroupStats} from 'sentry-fixture/groupStats';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Member as MemberFixture} from 'sentry-fixture/member';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Search} from 'sentry-fixture/search';
import {Tags} from 'sentry-fixture/tags';

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
import ProjectsStore from 'sentry/stores/projectsStore';
import TagStore from 'sentry/stores/tagStore';
import {SavedSearchVisibility} from 'sentry/types';
import localStorageWrapper from 'sentry/utils/localStorage';
import * as parseLinkHeader from 'sentry/utils/parseLinkHeader';
import IssueListWithStores, {IssueListOverview} from 'sentry/views/issueList/overview';

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

const {organization, router, routerContext} = initializeOrg({
  organization: {
    id: '1337',
    slug: 'org-slug',
    features: ['global-views'],
    access: [],
  },
  router: {
    location: {query: {}, search: ''},
    params: {},
  },
  project,
});

const routerProps = {
  params: router.params,
  location: router.location,
};

describe('IssueList', function () {
  let props;

  const tags = Tags();
  const group = GroupFixture({project});
  const groupStats = GroupStats();
  const savedSearch = Search({
    id: '789',
    query: 'is:unresolved TypeError',
    sort: 'date',
    name: 'Unresolved TypeErrors',
  });

  let fetchTagsRequest: jest.Mock;
  let fetchMembersRequest: jest.Mock;
  const api = new MockApiClient();
  const parseLinkHeaderSpy = jest.spyOn(parseLinkHeader, 'default');

  beforeEach(function () {
    // The tests fail because we have a "component update was not wrapped in act" error.
    // It should be safe to ignore this error, but we should remove the mock once we move to react testing library
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());

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
    fetchTagsRequest = MockApiClient.addMockResponse({
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

    TagStore.init?.();

    props = {
      api,
      savedSearchLoading: false,
      savedSearches: [savedSearch],
      useOrgSavedSearches: true,
      selection: {
        projects: [parseInt(organization.projects[0].id, 10)],
        environments: [],
        datetime: {period: '14d'},
      },
      location: {query: {query: 'is:unresolved'}, search: 'query=is:unresolved'},
      params: {},
      organization,
      tags: tags.reduce((acc, tag) => {
        acc[tag.key] = tag;

        return acc;
      }),
    };
  });

  afterEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    localStorageWrapper.clear();
  });

  describe('withStores and feature flags', function () {
    let savedSearchesRequest: jest.Mock;
    let recentSearchesRequest: jest.Mock;
    let issuesRequest: jest.Mock;

    beforeEach(function () {
      jest.mocked(StreamGroup).mockClear();

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

    it('loads group rows with default query (no pinned queries, async and no query in URL)', async function () {
      render(<IssueListWithStores {...routerProps} />, {
        context: routerContext,
      });

      // Loading saved searches
      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
      expect(savedSearchesRequest).toHaveBeenCalledTimes(1);

      await userEvent.click(await screen.findByDisplayValue('is:unresolved'));

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

      expect(screen.getByDisplayValue('is:unresolved')).toBeInTheDocument();

      expect(screen.getByRole('button', {name: /custom search/i})).toBeInTheDocument();
    });

    it('loads with query in URL and pinned queries', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          Search({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            query: 'is:resolved',
          }),
        ],
      });

      const location = LocationFixture({query: {query: 'level:foo'}});

      render(<IssueListWithStores {...merge({}, routerProps, {location})} />, {
        context: routerContext,
        router: {location},
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

      expect(screen.getByDisplayValue('level:foo')).toBeInTheDocument();

      // Tab shows "custom search"
      expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();
    });

    it('loads with a pinned custom query', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          Search({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            isGlobal: false,
            query: 'is:resolved',
          }),
        ],
      });

      render(<IssueListWithStores {...routerProps} />, {
        context: routerContext,
      });

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            // Should be called with default query
            data: expect.stringContaining('is%3Aresolved'),
          })
        );
      });

      expect(screen.getByDisplayValue('is:resolved')).toBeInTheDocument();

      // Organization saved search selector should have default saved search selected
      expect(screen.getByRole('button', {name: 'My Default Search'})).toBeInTheDocument();
    });

    it('shows archived tab', async function () {
      render(
        <IssueListWithStores
          {...routerProps}
          organization={{...organization, features: ['escalating-issues']}}
        />,
        {
          context: routerContext,
        }
      );

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalled();
      });

      expect(screen.getByDisplayValue('is:unresolved')).toBeInTheDocument();

      // TODO(workflow): remove this test when we remove the feature flag
      expect(screen.getByRole('tab', {name: 'Archived'})).toBeInTheDocument();
    });

    it('loads with a saved query', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          Search({
            id: '123',
            name: 'Assigned to Me',
            isPinned: false,
            isGlobal: true,
            query: 'assigned:me',
            sort: 'priority',
            type: 0,
          }),
        ],
      });

      const localRouter = {params: {searchId: '123'}};

      render(<IssueListWithStores {...merge({}, routerProps, localRouter)} />, {
        context: routerContext,
        router: localRouter,
      });

      await waitFor(() => {
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

      expect(screen.getByDisplayValue('assigned:me')).toBeInTheDocument();

      // Organization saved search selector should have default saved search selected
      expect(screen.getByRole('button', {name: 'Assigned to Me'})).toBeInTheDocument();
    });

    it('loads with a query in URL', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          Search({
            id: '123',
            name: 'Assigned to Me',
            isPinned: false,
            isGlobal: true,
            query: 'assigned:me',
            type: 0,
          }),
        ],
      });

      const localRouter = {location: {query: {query: 'level:error'}}};

      render(<IssueListWithStores {...merge({}, routerProps, localRouter)} />, {
        context: routerContext,
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

      expect(screen.getByDisplayValue('level:error')).toBeInTheDocument();

      // Organization saved search selector should have default saved search selected
      expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();
    });

    it('loads with an empty query in URL', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          Search({
            id: '123',
            name: 'My Pinned Search',
            isPinned: true,
            isGlobal: false,
            query: 'is:resolved',
          }),
        ],
      });

      render(
        <IssueListWithStores
          {...merge({}, routerProps, {location: {query: {query: undefined}}})}
        />,
        {context: routerContext}
      );

      await waitFor(() => {
        expect(issuesRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            // Should be called with empty query
            data: expect.stringContaining(''),
          })
        );
      });

      expect(screen.getByDisplayValue('is:resolved')).toBeInTheDocument();

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

      const defaultProps = {
        ...props,
        ...routerProps,
        useOrgSavedSearches: true,
        selection: {
          projects: [],
          environments: [],
          datetime: {period: '14d'},
        },
        organization: Organization({
          features: ['issue-stream-performance', 'issue-stream-performance-cache'],
          projects: [],
        }),
      };
      const {unmount} = render(<IssueListWithStores {...defaultProps} />, {
        context: routerContext,
        organization: defaultProps.organization,
      });

      expect(
        await screen.findByText(textWithMarkupMatcher('1-25 of 500'))
      ).toBeInTheDocument();
      expect(issuesRequest).toHaveBeenCalledTimes(1);
      unmount();

      // Mount component again, getting from cache
      render(<IssueListWithStores {...defaultProps} />, {
        context: routerContext,
        organization: defaultProps.organization,
      });

      expect(
        await screen.findByText(textWithMarkupMatcher('1-25 of 500'))
      ).toBeInTheDocument();
      expect(issuesRequest).toHaveBeenCalledTimes(1);
    });

    it('1 search', async function () {
      const localSavedSearch = {...savedSearch, projectId: null};
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });

      render(<IssueListWithStores {...routerProps} />, {
        context: routerContext,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      await userEvent.click(screen.getByRole('button', {name: /custom search/i}));
      await userEvent.click(screen.getByRole('button', {name: localSavedSearch.name}));

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
        })
      );
    });

    it('clears a saved search when a custom one is entered', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [
          savedSearch,
          Search({
            id: '123',
            name: 'Pinned search',
            isPinned: true,
            isGlobal: false,
            query: 'is:resolved',
          }),
        ],
      });

      render(<IssueListWithStores {...routerProps} />, {
        context: routerContext,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      const queryInput = screen.getByDisplayValue('is:resolved');
      await userEvent.clear(queryInput);
      await userEvent.type(queryInput, 'dogs{enter}');

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/',
          query: {
            environment: [],
            project: [],
            referrer: 'issue-list',
            sort: '',
            query: 'dogs',
            statsPeriod: '14d',
          },
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
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });

      const {rerender} = render(<IssueListWithStores {...routerProps} />, {
        context: routerContext,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      const queryInput = screen.getByDisplayValue('is:unresolved');
      await userEvent.clear(queryInput);
      await userEvent.type(queryInput, 'assigned:me level:fatal{enter}');

      expect((browserHistory.push as jest.Mock).mock.calls[0][0]).toEqual(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'assigned:me level:fatal',
          }),
        })
      );

      await tick();

      const routerWithQuery = {location: {query: {query: 'assigned:me level:fatal'}}};

      rerender(<IssueListWithStores {...merge({}, routerProps, routerWithQuery)} />);

      expect(screen.getByRole('button', {name: 'Custom Search'})).toBeInTheDocument();

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
        expect(browserHistory.replace).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/issues/searches/666/',
            query: {
              referrer: 'search-bar',
            },
            search: '',
          })
        );
      });
    });

    it('unpins a custom query', async function () {
      const pinnedSearch = Search({
        id: '666',
        name: 'My Pinned Search',
        query: 'assigned:me level:fatal',
        sort: 'date',
        isPinned: true,
        visibility: SavedSearchVisibility.ORGANIZATION,
      });
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [pinnedSearch],
      });
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      const routerWithSavedSearch = {
        params: {searchId: pinnedSearch.id},
      };

      render(<IssueListWithStores {...merge({}, routerProps, routerWithSavedSearch)} />, {
        context: routerContext,
        router: routerWithSavedSearch,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      expect(screen.getByRole('button', {name: 'My Default Search'})).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText(/Remove Default/i));

      await waitFor(() => {
        expect(deletePin).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(browserHistory.replace).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/issues/',
          })
        );
      });
    });

    it('pins a saved query', async function () {
      const assignedToMe = Search({
        id: '234',
        name: 'Assigned to Me',
        isPinned: false,
        isGlobal: true,
        query: 'assigned:me',
        sort: 'date',
        type: 0,
      });

      savedSearchesRequest = MockApiClient.addMockResponse({
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
      const routerWithSavedSearch = {params: {searchId: '789'}};

      render(<IssueListWithStores {...merge({}, routerProps, routerWithSavedSearch)} />, {
        context: routerContext,
        router: routerWithSavedSearch,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      expect(screen.getByRole('button', {name: savedSearch.name})).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText(/set as default/i));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
        expect(browserHistory.replace).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/issues/searches/789/',
          })
        );
      });
    });

    it('pinning search should keep project selected', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });

      const {routerContext: newRouterContext, router: newRouter} = initializeOrg({
        router: {
          location: {
            query: {
              project: ['123'],
              environment: ['prod'],
              query: 'assigned:me level:fatal',
            },
          },
        },
      });

      render(
        <IssueListWithStores
          {...newRouter}
          selection={{
            projects: [123],
            environments: ['prod'],
            datetime: {
              end: null,
              period: null,
              start: null,
              utc: null,
            },
          }}
        />,
        {context: newRouterContext}
      );

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

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

      await userEvent.click(screen.getByLabelText(/set as default/i));

      await waitFor(() => {
        expect(createPin).toHaveBeenCalled();
        expect(browserHistory.replace).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/issues/searches/666/',
            query: expect.objectContaining({
              project: ['123'],
              environment: ['prod'],
              query: 'assigned:me level:fatal',
              referrer: 'search-bar',
            }),
          })
        );
      });
    });

    it('unpinning search should keep project selected', async function () {
      const localSavedSearch = {
        ...savedSearch,
        id: '666',
        isPinned: true,
        query: 'assigned:me level:fatal',
      };
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      const {routerContext: newRouterContext, router: newRouter} = initializeOrg(
        merge({}, router, {
          router: {
            location: {
              query: {
                project: ['123'],
                environment: ['prod'],
                query: 'assigned:me level:fatal',
              },
            },
            params: {searchId: '666'},
          },
        })
      );

      render(
        <IssueListWithStores
          {...newRouter}
          selection={{
            projects: [123],
            environments: ['prod'],
            datetime: {
              end: null,
              period: null,
              start: null,
              utc: null,
            },
          }}
          savedSearch={localSavedSearch}
        />,
        {context: newRouterContext}
      );

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      await userEvent.click(screen.getByLabelText(/Remove Default/i));

      await waitFor(() => {
        expect(deletePin).toHaveBeenCalled();
        expect(browserHistory.replace).toHaveBeenLastCalledWith(
          expect.objectContaining({
            pathname: '/organizations/org-slug/issues/',
            query: expect.objectContaining({
              project: ['123'],
              environment: ['prod'],
              query: 'assigned:me level:fatal',
              referrer: 'search-bar',
            }),
          })
        );
      });
    });

    it('does not allow pagination to "previous" while on first page and resets cursors when navigating back to initial page', async function () {
      const {rerender} = render(<IssueListWithStores {...routerProps} />, {
        context: routerContext,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));

      expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();

      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link: '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="previous"; results="true"; cursor="1443575000:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443574000:0:0>; rel="next"; results="true"; cursor="1443574000:0:0"',
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'Next'}));

      let pushArgs = {
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443575000:0:0',
          page: 1,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
          referrer: 'issue-list',
        },
      };

      await waitFor(() => {
        expect(browserHistory.push).toHaveBeenLastCalledWith(pushArgs);
      });

      rerender(<IssueListWithStores {...merge({}, routerProps, {location: pushArgs})} />);

      expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();

      // Click next again
      await userEvent.click(screen.getByRole('button', {name: 'Next'}));

      pushArgs = {
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443574000:0:0',
          page: 2,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
          referrer: 'issue-list',
        },
      };

      await waitFor(() => {
        expect(browserHistory.push).toHaveBeenLastCalledWith(pushArgs);
      });

      rerender(<IssueListWithStores {...merge({}, routerProps, {location: pushArgs})} />);

      // Click previous
      await userEvent.click(screen.getByRole('button', {name: 'Previous'}));

      pushArgs = {
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443575000:0:1',
          page: 1,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
          referrer: 'issue-list',
        },
      };

      await waitFor(() => {
        expect(browserHistory.push).toHaveBeenLastCalledWith(pushArgs);
      });

      rerender(<IssueListWithStores {...merge({}, routerProps, {location: pushArgs})} />);

      // Click previous back to initial page
      await userEvent.click(screen.getByRole('button', {name: 'Previous'}));

      await waitFor(() => {
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
            referrer: 'issue-list',
          },
        });
      });
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

      render(<IssueListOverview {...props} />, {
        context: routerContext,
      });

      const queryInput = screen.getByDisplayValue('is:unresolved');
      await userEvent.clear(queryInput);
      await userEvent.type(queryInput, 'is:ignored{enter}');

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/',
        query: {
          environment: [],
          project: [parseInt(project.id, 10)],
          query: 'is:ignored',
          statsPeriod: '14d',
          referrer: 'issue-list',
        },
      });
    });
  });

  it('fetches tags and members', async function () {
    render(<IssueListOverview {...routerProps} {...props} />, {context: routerContext});

    await waitFor(() => {
      expect(fetchTagsRequest).toHaveBeenCalled();
      expect(fetchMembersRequest).toHaveBeenCalled();
    });
  });

  describe('componentDidUpdate fetching groups', function () {
    let fetchDataMock;

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

    it('fetches data on selection change', function () {
      const {rerender} = render(<IssueListOverview {...routerProps} {...props} />, {
        context: routerContext,
      });

      rerender(
        <IssueListOverview
          {...routerProps}
          {...props}
          selection={{projects: [99], environments: [], datetime: {period: '24h'}}}
        />
      );

      expect(fetchDataMock).toHaveBeenCalled();
    });

    it('fetches data on savedSearch change', function () {
      const {rerender} = render(<IssueListOverview {...routerProps} {...props} />, {
        context: routerContext,
      });

      rerender(
        <IssueListOverview
          {...routerProps}
          {...props}
          savedSearch={{id: '1', query: 'is:resolved'}}
        />
      );

      expect(fetchDataMock).toHaveBeenCalled();
    });

    it('uses correct statsPeriod when fetching issues list and no datetime given', function () {
      const {rerender} = render(<IssueListOverview {...routerProps} {...props} />, {
        context: routerContext,
      });
      const selection = {projects: [99], environments: [], datetime: {}};
      rerender(<IssueListOverview {...routerProps} {...props} selection={selection} />);

      expect(fetchDataMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          data: 'collapse=stats&collapse=unhandled&expand=owners&expand=inbox&limit=25&project=99&query=is%3Aunresolved&savedSearch=1&shortIdLookup=1&statsPeriod=14d',
        })
      );
    });
  });

  describe('componentDidUpdate fetching members', function () {
    it('fetches memberlist and tags list on project change', function () {
      const {rerender} = render(<IssueListOverview {...routerProps} {...props} />, {
        context: routerContext,
      });
      // Called during componentDidMount
      expect(fetchMembersRequest).toHaveBeenCalledTimes(1);
      expect(fetchTagsRequest).toHaveBeenCalledTimes(1);

      const selection = {
        projects: [99],
        environments: [],
        datetime: {period: '24h'},
      };
      rerender(<IssueListOverview {...routerProps} {...props} selection={selection} />);
      expect(fetchMembersRequest).toHaveBeenCalledTimes(2);
      expect(fetchTagsRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('render states', function () {
    it('displays the loading icon when saved searches are loading', function () {
      render(<IssueListOverview {...routerProps} {...props} savedSearchLoading />, {
        context: routerContext,
      });
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('displays an error when issues fail to load', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        status: 500,
        statusCode: 500,
      });
      render(<IssueListOverview {...routerProps} {...props} />, {
        context: routerContext,
      });

      expect(await screen.findByTestId('loading-error')).toBeInTheDocument();
    });

    it('displays congrats robots animation with only is:unresolved query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });
      render(<IssueListOverview {...routerProps} {...props} />, {context: routerContext});

      expect(
        await screen.findByText(/We couldn't find any issues that matched your filters/i)
      ).toBeInTheDocument();
    });

    it('displays an empty resultset with a non-default query', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      render(<IssueListOverview {...routerProps} {...props} />, {context: routerContext});

      await userEvent.type(
        screen.getByDisplayValue('is:unresolved'),
        ' level:error{enter}'
      );

      expect(
        await screen.findByText(/We couldn't find any issues that matched your filters/i)
      ).toBeInTheDocument();
    });
  });

  describe('Error Robot', function () {
    const createWrapper = async moreProps => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {
          Link: DEFAULT_LINKS_HEADER,
        },
      });

      const defaultProps = {
        ...props,
        useOrgSavedSearches: true,
        selection: {
          projects: [],
          environments: [],
          datetime: {period: '14d'},
        },
        ...merge({}, routerProps, {
          params: {},
          location: {query: {query: 'is:unresolved'}, search: 'query=is:unresolved'},
        }),
        organization: Organization({
          projects: [],
        }),
        ...moreProps,
      };
      render(<IssueListOverview {...defaultProps} />, {
        context: routerContext,
      });

      await waitForElementToBeRemoved(() => screen.getByTestId('loading-indicator'));
    };

    it('displays when no projects selected and all projects user is member of, async does not have first event', async function () {
      const projects = [
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
        body: projects,
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/foo/issues/',
        body: [],
      });

      await createWrapper({
        organization: Organization({
          projects,
        }),
      });

      expect(screen.getByTestId('awaiting-events')).toBeInTheDocument();
    });

    it('does not display when no projects selected and any projects have a first event', async function () {
      const projects = [
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
        body: projects,
      });
      await createWrapper({
        organization: Organization({
          projects,
        }),
      });

      expect(screen.queryByTestId('awaiting-events')).not.toBeInTheDocument();
    });

    it('displays when all selected projects do not have first event', async function () {
      const projects = [
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
        body: projects,
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
        organization: Organization({
          projects,
        }),
      });

      expect(await screen.findByTestId('awaiting-events')).toBeInTheDocument();
    });

    it('does not display when any selected projects have first event', async function () {
      const projects = [
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
        body: projects,
      });

      await createWrapper({
        selection: {
          projects: [1, 2],
          environments: [],
          datetime: {period: '14d'},
        },
        organization: Organization({
          projects,
        }),
      });

      expect(screen.queryByTestId('awaiting-events')).not.toBeInTheDocument();
    });
  });

  it('displays a count that represents the current page', function () {
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
    props = {
      ...props,
      location: {
        query: {
          cursor: 'some cursor',
          page: 1,
        },
      },
    };

    const {routerContext: newRouterContext} = initializeOrg();
    const {rerender} = render(<IssueListOverview {...props} />, {
      context: newRouterContext,
    });

    expect(screen.getByText(textWithMarkupMatcher('1-25 of 500'))).toBeInTheDocument();

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
    rerender(<IssueListOverview {...props} />);

    expect(screen.getByText(textWithMarkupMatcher('26-50 of 500'))).toBeInTheDocument();
  });

  describe('project low priority queue alert', function () {
    const {routerContext: newRouterContext} = initializeOrg();

    beforeEach(function () {
      act(() => ProjectsStore.reset());
    });

    it('does not render event processing alert', function () {
      act(() => ProjectsStore.loadInitialData([project]));

      render(<IssueListOverview {...props} />, {
        context: newRouterContext,
      });

      expect(screen.queryByText(/event processing/i)).not.toBeInTheDocument();
    });

    describe('renders alert', function () {
      it('for one project', function () {
        act(() =>
          ProjectsStore.loadInitialData([
            {...project, eventProcessing: {symbolicationDegraded: true}},
          ])
        );

        render(<IssueListOverview {...props} />, {
          context: routerContext,
        });

        expect(
          screen.getByText(/Event Processing for this project is currently degraded/i)
        ).toBeInTheDocument();
      });

      it('for multiple projects', function () {
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

        render(
          <IssueListOverview
            {...props}
            selection={{
              ...props.selection,
              projects: [Number(project.id), Number(projectBar.id)],
            }}
          />,
          {
            context: newRouterContext,
          }
        );

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
