import {browserHistory} from 'react-router';
import cloneDeep from 'lodash/cloneDeep';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, shallow} from 'sentry-test/enzyme';

import ErrorRobot from 'app/components/errorRobot';
import GroupStore from 'app/stores/groupStore';
import IssueListWithStores, {IssueListOverview} from 'app/views/issueList/overview';
import StreamGroup from 'app/components/stream/group';
import TagStore from 'app/stores/tagStore';

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
  let wrapper;
  let props;

  let organization;
  let project;
  let group;
  let savedSearch;

  let fetchTagsRequest;
  let fetchMembersRequest;
  const api = new MockApiClient();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    project = TestStubs.ProjectDetails({
      id: '3559',
      name: 'Foo Project',
      slug: 'project-slug',
      firstEvent: true,
    });
    organization = TestStubs.Organization({
      id: '1337',
      slug: 'org-slug',
      access: ['releases'],
      features: [],
      projects: [project],
    });

    savedSearch = TestStubs.Search({
      id: '789',
      query: 'is:unresolved',
      name: 'Unresolved Issues',
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
      params: {orgId: organization.slug},
      organization,
      tags: tags.reduce((acc, tag) => {
        acc[tag.key] = tag;

        return acc;
      }),
    };
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
    if (wrapper) {
      wrapper.unmount();
    }
    wrapper = null;
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
      w.find('SavedSearchSelector DropdownMenu ButtonTitle').text();

    const getSearchBarValue = w =>
      w.find('SmartSearchBarContainer StyledInput').prop('value').trim();

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
        routerContext
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
      // Update stores with saved searches
      await tick();
      await tick();
      wrapper.update();

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

      expect(getSearchBarValue(wrapper)).toBe('is:unresolved');

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Unresolved Issues');

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

      // Update stores with saved searches
      await tick();
      await tick();
      wrapper.update();

      // Main /issues/ request
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('level%3Afoo'),
        })
      );

      expect(getSearchBarValue(wrapper)).toBe('level:foo');

      // Custom search
      expect(getSavedSearchTitle(wrapper)).toBe('Custom Search');
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

      await tick();
      await tick();
      wrapper.update();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('is%3Aresolved'),
        })
      );

      expect(getSearchBarValue(wrapper)).toBe('is:resolved');

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Org Custom');
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

      await tick();
      await tick();
      wrapper.update();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('is%3Aresolved'),
        })
      );

      expect(getSearchBarValue(wrapper)).toBe('is:resolved');

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('My Pinned Search');
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
            projectId: null,
            type: 0,
          }),
        ],
      });
      createWrapper({params: {searchId: '123'}});

      await tick();
      await tick();
      wrapper.update();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('assigned%3Ame'),
        })
      );

      expect(getSearchBarValue(wrapper)).toBe('assigned:me');

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Assigned to Me');
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

      await tick();
      await tick();
      wrapper.update();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with default query
          data: expect.stringContaining('level%3Aerror'),
        })
      );

      expect(getSearchBarValue(wrapper)).toBe('level:error');

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('Custom Search');
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

      await tick();
      await tick();
      wrapper.update();

      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          // Should be called with empty query
          data: expect.stringContaining(''),
        })
      );

      expect(getSearchBarValue(wrapper)).toBe('is:resolved');

      // Organization saved search selector should have default saved search selected
      expect(getSavedSearchTitle(wrapper)).toBe('My Pinned Search');
    });

    it('selects a saved search and changes sort', async function () {
      const localSavedSearch = {...savedSearch, projectId: null};
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [localSavedSearch],
      });
      createWrapper();
      await tick();
      await tick();
      wrapper.update();

      wrapper.find('SavedSearchSelector DropdownButton').simulate('click');
      wrapper.find('SavedSearchSelector MenuItem a').first().simulate('click');

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
        })
      );

      // Need to update component
      wrapper.setProps({
        savedSearch: localSavedSearch,
        location: {
          ...router.location,
          pathname: '/organizations/org-slug/issues/searches/789/',
          query: {
            sort: 'freq',
            environment: [],
            project: [],
          },
        },
      });
      await tick();
      wrapper.update();

      wrapper.find('IssueListSortOptions DropdownButton').simulate('click');
      wrapper.find('IssueListSortOptions MenuItem span').at(3).simulate('click');

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
      await tick();
      await tick();
      await wrapper.update();

      // Update the search input
      wrapper
        .find('IssueListFilters SmartSearchBar StyledInput input')
        .simulate('change', {target: {value: 'dogs'}});
      // Submit the form
      wrapper.find('IssueListFilters SmartSearchBar form').simulate('submit');
      await wrapper.update();

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
      createWrapper();
      await tick();
      await tick();
      wrapper.update();

      const createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...savedSearch,
          id: '666',
          name: 'My Pinned Search',
          query: 'assigned:me level:fatal',
          isPinned: true,
        },
      });
      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });

      wrapper
        .find('SmartSearchBar input')
        .simulate('change', {target: {value: 'assigned:me level:fatal'}});
      wrapper.find('SmartSearchBar form').simulate('submit');

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'assigned:me level:fatal',
          }),
        })
      );

      await tick();

      wrapper.setProps({
        location: {
          ...router.location,
          query: {
            query: 'assigned:me level:fatal',
          },
        },
      });

      expect(wrapper.find('SavedSearchSelector ButtonTitle').text()).toBe(
        'Custom Search'
      );

      wrapper.find('Button[aria-label="Pin this search"] button').simulate('click');

      expect(createPin).toHaveBeenCalled();

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/666/',
          query: {},
          search: '',
        })
      );

      wrapper.setProps({
        params: {
          ...router.params,
          searchId: '666',
        },
      });

      await tick();
      wrapper.update();

      expect(wrapper.find('SavedSearchSelector ButtonTitle').text()).toBe(
        'My Pinned Search'
      );

      wrapper.find('Button[aria-label="Unpin this search"] button').simulate('click');

      expect(deletePin).toHaveBeenCalled();

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/',
          query: {
            query: 'assigned:me level:fatal',
          },
        })
      );
    });

    it('pins and unpins a saved query', async function () {
      const assignedToMe = TestStubs.Search({
        id: '234',
        name: 'Assigned to Me',
        isPinned: false,
        isGlobal: true,
        query: 'assigned:me',
        projectId: null,
        type: 0,
      });

      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch, assignedToMe],
      });
      createWrapper();
      await tick();
      await tick();
      wrapper.update();

      let createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...savedSearch,
          isPinned: true,
        },
      });

      wrapper.find('SavedSearchSelector DropdownButton').simulate('click');
      wrapper.find('SavedSearchSelector MenuItem a').first().simulate('click');

      await tick();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
          query: {
            environment: [],
            project: ['3559'],
            statsPeriod: '14d',
          },
        })
      );

      wrapper.setProps({
        params: {
          ...router.params,
          searchId: '789',
        },
      });

      expect(wrapper.find('SavedSearchSelector ButtonTitle').text()).toBe(
        'Unresolved Issues'
      );

      wrapper.find('Button[aria-label="Pin this search"] button').simulate('click');

      expect(createPin).toHaveBeenCalled();

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/789/',
        })
      );

      wrapper.setProps({
        params: {
          ...router.params,
          searchId: '789',
        },
      });

      await tick();
      wrapper.update();

      expect(wrapper.find('SavedSearchSelector ButtonTitle').text()).toBe(
        'Unresolved Issues'
      );

      // Select other saved search
      wrapper.find('SavedSearchSelector DropdownButton').simulate('click');
      wrapper.find('SavedSearchSelector MenuItem a').at(1).simulate('click');

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/234/',
          query: {
            project: [],
            environment: [],
            statsPeriod: '14d',
          },
        })
      );

      wrapper.setProps({
        params: {
          ...router.params,
          searchId: '234',
        },
      });

      expect(wrapper.find('SavedSearchSelector ButtonTitle').text()).toBe(
        'Assigned to Me'
      );

      createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...assignedToMe,
          isPinned: true,
        },
      });

      wrapper.find('Button[aria-label="Pin this search"] button').simulate('click');

      expect(createPin).toHaveBeenCalled();

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/234/',
        })
      );

      wrapper.setProps({
        params: {
          ...router.params,
          searchId: '234',
        },
      });

      await tick();
      wrapper.update();

      expect(wrapper.find('SavedSearchSelector ButtonTitle').text()).toBe(
        'Assigned to Me'
      );
    });

    it('pinning and unpinning searches should keep project selected', async function () {
      savedSearchesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/searches/',
        body: [savedSearch],
      });
      createWrapper({
        selection: {
          projects: [123],
          environments: ['prod'],
          datetime: {},
        },
        location: {query: {project: ['123'], environment: ['prod']}},
      });
      await tick();
      await tick();
      wrapper.update();

      const deletePin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
      });
      const createPin = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {
          ...savedSearch,
          id: '666',
          name: 'My Pinned Search',
          query: 'assigned:me level:fatal',
          isPinned: true,
        },
      });

      wrapper
        .find('SmartSearchBar input')
        .simulate('change', {target: {value: 'assigned:me level:fatal'}});
      wrapper.find('SmartSearchBar form').simulate('submit');

      await tick();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            project: [123],
            environment: ['prod'],
            query: 'assigned:me level:fatal',
          }),
        })
      );

      const newRouter = {
        ...router,
        location: {
          ...router.location,
          query: {
            ...router.location.query,
            project: [123],
            environment: ['prod'],
            query: 'assigned:me level:fatal',
          },
        },
      };

      wrapper.setProps({...newRouter, router: newRouter});
      wrapper.setContext({router: newRouter});
      wrapper.update();

      wrapper.find('Button[aria-label="Pin this search"] button').simulate('click');

      expect(createPin).toHaveBeenCalled();

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/searches/666/',
          query: expect.objectContaining({
            project: [123],
            environment: ['prod'],
            query: 'assigned:me level:fatal',
          }),
        })
      );

      wrapper.setProps({
        params: {
          ...router.params,
          searchId: '666',
        },
      });

      await tick();
      wrapper.update();

      wrapper.find('Button[aria-label="Unpin this search"] button').simulate('click');

      expect(deletePin).toHaveBeenCalled();

      await tick();
      wrapper.update();

      expect(browserHistory.push).toHaveBeenLastCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/issues/',
          query: expect.objectContaining({
            project: [123],
            environment: ['prod'],
            query: 'assigned:me level:fatal',
          }),
        })
      );
    });

    it.todo('saves a new query');

    it.todo('loads pinned search when invalid saved search id is accessed');

    it('does not allow pagination to "previous" while on first page and resets cursors when navigating back to initial page', async function () {
      let pushArgs;
      createWrapper();
      await tick();
      await tick();
      wrapper.update();

      expect(wrapper.find('Pagination Button').first().prop('disabled')).toBe(true);

      issuesRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group],
        headers: {
          Link:
            '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="previous"; results="true"; cursor="1443575000:0:1", <http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443574000:0:0>; rel="next"; results="true"; cursor="1443574000:0:0"',
        },
      });

      // Click next
      wrapper.find('Pagination Button').last().simulate('click');

      await tick();

      pushArgs = {
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443575000:0:0',
          page: 1,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
        },
      };
      expect(browserHistory.push).toHaveBeenLastCalledWith(pushArgs);
      wrapper.setProps({location: pushArgs});
      wrapper.setContext({location: pushArgs});

      expect(wrapper.find('Pagination Button').first().prop('disabled')).toBe(false);

      // Click next again
      wrapper.find('Pagination Button').last().simulate('click');

      await tick();

      pushArgs = {
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443574000:0:0',
          page: 2,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
        },
      };
      expect(browserHistory.push).toHaveBeenLastCalledWith(pushArgs);
      wrapper.setProps({location: pushArgs});
      wrapper.setContext({location: pushArgs});

      // Click previous
      wrapper.find('Pagination Button').first().simulate('click');

      await tick();

      pushArgs = {
        pathname: '/organizations/org-slug/issues/',
        query: {
          cursor: '1443575000:0:1',
          page: 1,
          environment: [],
          project: [],
          query: 'is:unresolved',
          statsPeriod: '14d',
        },
      };
      expect(browserHistory.push).toHaveBeenLastCalledWith(pushArgs);
      wrapper.setProps({location: pushArgs});
      wrapper.setContext({location: pushArgs});

      // Click previous back to initial page
      wrapper.find('Pagination Button').first().simulate('click');
      await tick();

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
    beforeEach(function () {
      wrapper = shallow(<IssueListOverview {...props} />);
      instance = wrapper.instance();
    });

    it('transitions to query updates', function () {
      instance.transitionTo({query: 'is:ignored'});

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/',
        query: {
          environment: [],
          project: [parseInt(project.id, 10)],
          query: 'is:ignored',
          statsPeriod: '14d',
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
          environment: [],
          project: [parseInt(project.id, 10)],
          cursor: '1554756114000:0:0',
          statsPeriod: '14d',
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
          environment: [],
          project: [parseInt(project.id, 10)],
          cursor: '1554756114000:0:0',
          statsPeriod: '14d',
        },
      });
    });

    it('transitions to saved search that has a projectId', function () {
      savedSearch = {
        id: 123,
        projectId: 99,
        query: 'foo:bar',
      };
      instance.transitionTo(null, savedSearch);

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/123/',
        query: {
          environment: [],
          project: [savedSearch.projectId],
          statsPeriod: '14d',
        },
      });
    });

    it('goes to all projects when using a basic saved search and global-views feature', function () {
      organization.features = ['global-views'];
      savedSearch = {
        id: 1,
        project: null,
        query: 'is:unresolved',
      };
      instance.transitionTo(null, savedSearch);

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/1/',
        query: {
          project: [parseInt(project.id, 10)],
          environment: [],
          statsPeriod: '14d',
        },
      });
    });

    it('retains project selection when using a basic saved search and no global-views feature', function () {
      organization.features = [];
      savedSearch = {
        id: 1,
        projectId: null,
        query: 'is:unresolved',
      };
      instance.transitionTo(null, savedSearch);

      expect(browserHistory.push).toHaveBeenCalledWith({
        pathname: '/organizations/org-slug/issues/searches/1/',
        query: {
          environment: [],
          project: props.selection.projects,
          statsPeriod: '14d',
        },
      });
    });
  });

  describe('getEndpointParams', function () {
    beforeEach(function () {
      wrapper = shallow(<IssueListOverview {...props} />);
    });

    it('omits null values', function () {
      wrapper.setProps({
        selection: {
          projects: null,
          environments: null,
          datetime: {period: '14d'},
        },
      });
      const value = wrapper.instance().getEndpointParams();

      expect(value.project).toBeUndefined();
      expect(value.projects).toBeUndefined();
      expect(value.environment).toBeUndefined();
      expect(value.environments).toBeUndefined();
      expect(value.statsPeriod).toEqual('14d');
    });

    it('omits defaults', function () {
      wrapper.setProps({
        location: {
          query: {
            sort: 'date',
            groupStatsPeriod: '24h',
          },
        },
      });
      const value = wrapper.instance().getEndpointParams();

      expect(value.groupStatsPeriod).toBeUndefined();
      expect(value.sort).toBeUndefined();
    });

    it('uses saved search data', function () {
      const value = wrapper.instance().getEndpointParams();

      expect(value.query).toEqual(savedSearch.query);
      expect(value.project).toEqual([parseInt(savedSearch.projectId, 10)]);
    });
  });

  describe('componentDidMount', function () {
    beforeEach(function () {
      wrapper = shallow(<IssueListOverview {...props} />);
    });

    it('fetches tags and sets state', async function () {
      const instance = wrapper.instance();
      await instance.componentDidMount();

      expect(fetchTagsRequest).toHaveBeenCalled();
      expect(instance.state.tagsLoading).toBeFalsy();
    });

    it('fetches members and sets state', async function () {
      const instance = wrapper.instance();
      await instance.componentDidMount();
      await wrapper.update();

      expect(fetchMembersRequest).toHaveBeenCalled();

      const members = instance.state.memberList;
      // Spot check the resulting structure as we munge it a bit.
      expect(members).toBeTruthy();
      expect(members[project.slug]).toBeTruthy();
      expect(members[project.slug][0].email).toBeTruthy();
    });

    it('fetches groups when there is no searchid', async function () {
      await wrapper.instance().componentDidMount();
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
      wrapper = shallow(<IssueListOverview {...props} />);
    });

    it('fetches data on selection change', function () {
      const selection = {projects: [99], environments: [], datetime: {period: '24h'}};

      wrapper.setProps({selection, foo: 'bar'});

      expect(fetchDataMock).toHaveBeenCalled();
    });

    it('fetches data on savedSearch change', function () {
      savedSearch = {id: '1', query: 'is:resolved'};
      wrapper.setProps({savedSearch});
      wrapper.update();

      expect(fetchDataMock).toHaveBeenCalled();
    });

    it('fetches data on location change', async function () {
      const queryAttrs = ['query', 'sort', 'statsPeriod', 'cursor', 'groupStatsPeriod'];
      const location = cloneDeep(props.location);
      for (const [i, attr] of queryAttrs.entries()) {
        // reclone each iteration so that only one property changes.
        const newLocation = cloneDeep(location);
        newLocation.query[attr] = 'newValue';
        wrapper.setProps({location: newLocation});
        await tick();
        wrapper.update();

        // Each property change after the first will actually cause two new
        // fetchData calls, one from the property change and another from a
        // change in this.state.issuesLoading going from false to true.
        expect(fetchDataMock).toHaveBeenCalledTimes(2 * i + 1);
      }
    });

    it('uses correct statsPeriod when fetching issues list and no datetime given', async function () {
      const selection = {projects: [99], environments: [], datetime: {}};
      wrapper.setProps({selection, foo: 'bar'});

      expect(fetchDataMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          data:
            'limit=25&project=99&query=is%3Aunresolved&shortIdLookup=1&statsPeriod=14d',
        })
      );
    });
  });

  describe('componentDidUpdate fetching members', function () {
    beforeEach(function () {
      wrapper = shallow(<IssueListOverview {...props} />);
      wrapper.instance().fetchData = jest.fn();
    });

    it('fetches memberlist on project change', function () {
      // Called during componentDidMount
      expect(fetchMembersRequest).toHaveBeenCalledTimes(1);

      const selection = {
        projects: [99],
        environments: [],
        datetime: {period: '24h'},
      };
      wrapper.setProps({selection});
      wrapper.update();
      expect(fetchMembersRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('componentDidUpdate fetching tags', function () {
    beforeEach(function () {
      wrapper = shallow(<IssueListOverview {...props} />);
      wrapper.instance().fetchData = jest.fn();
    });

    it('fetches tags on project change', function () {
      // Called during componentDidMount
      expect(fetchTagsRequest).toHaveBeenCalledTimes(1);

      const selection = {
        projects: [99],
        environments: [],
        datetime: {period: '24h'},
      };
      wrapper.setProps({selection});
      wrapper.update();

      expect(fetchTagsRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('processingIssues', function () {
    beforeEach(function () {
      wrapper = shallow(<IssueListOverview {...props} />);
    });

    it('fetches and displays processing issues', async function () {
      const instance = wrapper.instance();
      instance.componentDidMount();
      await wrapper.update();

      GroupStore.add([group]);
      wrapper.setState({
        groupIds: ['1'],
        loading: false,
      });

      const issues = wrapper.find('ProcessingIssueList');
      expect(issues).toHaveLength(1);
    });
  });

  describe('render states', function () {
    beforeEach(function () {
      wrapper = mountWithTheme(<IssueListOverview {...props} />);
    });

    it('displays the loading icon', function () {
      wrapper.setState({savedSearchLoading: true});
      expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
    });

    it('displays an error', function () {
      wrapper.setState({
        error: 'Things broke',
        savedSearchLoading: false,
        issuesLoading: false,
      });

      const error = wrapper.find('LoadingError');
      expect(error).toHaveLength(1);
      expect(error.props().message).toEqual('Things broke');
    });

    it('displays congrats robots animation with only is:unresolved query', async function () {
      wrapper.setState({
        savedSearchLoading: false,
        issuesLoading: false,
        error: false,
        groupIds: [],
      });
      await tick();
      wrapper.update();

      expect(wrapper.find('NoUnresolvedIssues').exists()).toBe(true);
    });

    it('displays an empty resultset with is:unresolved and level:error query', async function () {
      const errorsOnlyQuery = {
        ...props,
        location: {
          query: {query: 'is:unresolved level:error'},
        },
      };

      wrapper = mountWithTheme(<IssueListOverview {...errorsOnlyQuery} />);

      wrapper.setState({
        savedSearchLoading: false,
        issuesLoading: false,
        error: false,
        groupIds: [],
        fetchingSentFirstEvent: false,
        sentFirstEvent: true,
      });
      await tick();
      wrapper.update();

      expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
    });

    it('displays an empty resultset with has:browser query', async function () {
      const hasBrowserQuery = {
        ...props,
        location: {
          query: {query: 'has:browser'},
        },
      };

      wrapper = mountWithTheme(<IssueListOverview {...hasBrowserQuery} />);

      wrapper.setState({
        savedSearchLoading: false,
        issuesLoading: false,
        error: false,
        groupIds: [],
        fetchingSentFirstEvent: false,
        sentFirstEvent: true,
      });
      await tick();
      wrapper.update();

      expect(wrapper.find('EmptyStateWarning').exists()).toBe(true);
    });
  });

  describe('Error Robot', function () {
    const createWrapper = moreProps => {
      const defaultProps = {
        ...props,
        savedSearchLoading: false,
        useOrgSavedSearches: true,
        selection: {
          projects: [],
          environments: [],
          datetime: {period: '14d'},
        },
        location: {query: {query: 'is:unresolved'}, search: 'query=is:unresolved'},
        params: {orgId: organization.slug},
        organization: TestStubs.Organization({
          projects: [],
        }),
        ...moreProps,
      };
      const localWrapper = mountWithTheme(<IssueListOverview {...defaultProps} />);
      localWrapper.setState({
        error: false,
        issuesLoading: false,
        groupIds: [],
      });

      return localWrapper;
    };

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
      wrapper = createWrapper({
        organization: TestStubs.Organization({
          projects,
        }),
      });
      await tick();
      wrapper.update();

      expect(wrapper.find(ErrorRobot)).toHaveLength(1);
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
      await tick();
      wrapper.update();

      expect(wrapper.find(ErrorRobot)).toHaveLength(0);
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

      wrapper = createWrapper({
        selection: {
          projects: [1, 2],
          environments: [],
          datetime: {period: '14d'},
        },
        organization: TestStubs.Organization({
          projects,
        }),
      });
      await tick();
      wrapper.update();

      expect(wrapper.find(ErrorRobot)).toHaveLength(1);
    });

    it('does not display when any selected projects have first event', function () {
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

      wrapper = createWrapper({
        selection: {
          projects: [1, 2],
          environments: [],
          datetime: {period: '14d'},
        },
        organization: TestStubs.Organization({
          projects,
        }),
      });

      expect(wrapper.find(ErrorRobot)).toHaveLength(0);
    });
  });

  describe('with inbox feature', function () {
    it('renders inbox layout', function () {
      organization.features = ['inbox'];
      wrapper = mountWithTheme(<IssueListOverview {...props} />);
      expect(wrapper.find('IssueListHeader').exists()).toBeTruthy();
    });
  });
});
