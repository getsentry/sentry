import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';

import DiscoverContainerWithStore, {DiscoverContainer} from 'app/views/discover';

describe('DiscoverContainer', function() {
  beforeEach(function() {
    browserHistory.push = jest.fn();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
      method: 'POST',
      body: {
        data: [
          {tags_key: 'tag1', count: 5},
          {tags_key: 'tag2', count: 1},
        ],
        timing: {},
        meta: [],
      },
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('new query', function() {
    let wrapper;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project({id: '1', slug: 'test-project'})],
      features: ['discover'],
    });
    beforeEach(async function() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects',
        method: 'GET',
        body: {
          data: organization.projects,
        },
      });
      wrapper = mountWithTheme(
        <DiscoverContainer
          location={{query: {}, search: ''}}
          params={{}}
          selection={{projects: [], environments: [], datetime: {}}}
          organization={organization}
        />,
        TestStubs.routerContext()
      );
      await tick();
    });

    it('fetches tags', function() {
      const queryBuilder = wrapper.instance().queryBuilder;
      expect(wrapper.state().isLoading).toBe(false);
      expect(queryBuilder.getColumns().some(column => column.name === 'tag1')).toBe(true);
      expect(queryBuilder.getColumns().some(column => column.name === 'tag2')).toBe(true);
    });
  });

  describe('saved query', function() {
    let wrapper, savedQueryMock, addMock, savedQueries;
    const organization = TestStubs.Organization({
      projects: [TestStubs.Project()],
      features: ['discover'],
    });

    const createWrapper = async (props, withStore) => {
      const Component = withStore ? DiscoverContainerWithStore : DiscoverContainer;
      const wrap = mountWithTheme(
        <Component
          location={{query: {}, search: ''}}
          params={{savedQueryId: 1}}
          organization={organization}
          {...(withStore ? {} : {selection: {datetime: {}}})}
          {...props}
        />,
        TestStubs.routerContext()
      );
      await tick();
      wrap.update();
      return wrap;
    };

    beforeEach(async function() {
      savedQueries = [
        TestStubs.DiscoverSavedQuery({id: '1', name: 'one'}),
        TestStubs.DiscoverSavedQuery({
          id: '2',
          name: 'two',
          start: '2019-04-01T07:00:00.000',
          end: '2019-04-04T06:59:59.000',
        }),
      ];

      savedQueryMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        body: savedQueries[0],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/',
        body: savedQueries,
      });

      addMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/',
        method: 'POST',
      });
    });

    describe('Without Global Header Store', function() {
      let request;
      beforeEach(async function() {
        request = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
          method: 'POST',
          body: {timing: {}, data: [], meta: []},
        });
        wrapper = await createWrapper();
      });

      afterEach(function() {
        MockApiClient.clearMockResponses();
      });

      it('fetches saved query', function() {
        expect(savedQueryMock).toHaveBeenCalled();
      });

      it('navigates to and opens query with no date ranges saved', function() {
        const nextQueryMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/discover/saved/1/',
          body: savedQueries[0],
        });

        expect(wrapper.find('SavedQueryListItem')).toHaveLength(2);

        wrapper.setProps({
          params: {savedQueryId: '1'},
        });

        expect(savedQueryMock).toHaveBeenCalledTimes(1);
        expect(nextQueryMock).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              aggregations: [],
              conditions: [],
              fields: ['test'],
              limit: expect.any(Number),
              orderby: expect.any(String),
              projects: [2],
              range: '14d',
            },
          })
        );
      });

      it('navigates to and opens query with absolute dates saved', async function() {
        const nextQueryMock = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/discover/saved/2/',
          body: savedQueries[1],
        });

        expect(wrapper.find('SavedQueryListItem')).toHaveLength(2);

        wrapper.setProps({
          params: {savedQueryId: '2'},
        });

        // This is needed because we are changing from savedQueryId: 1 --> 2,
        // so unliked the above, this will hit cWRP (see `createWrapper()`)
        await tick();
        wrapper.update();

        expect(savedQueryMock).toHaveBeenCalledTimes(1);
        expect(nextQueryMock).toHaveBeenCalledTimes(1);
        expect(request).toHaveBeenLastCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              aggregations: [],
              conditions: [],
              start: '2019-04-01T07:00:00.000',
              end: '2019-04-04T06:59:59.000',
              fields: ['test'],
              limit: expect.any(Number),
              orderby: expect.any(String),
              projects: [2],
            },
          })
        );
      });

      it('toggles edit mode', function() {
        wrapper.instance().toggleEditMode();
        expect(browserHistory.push).toHaveBeenCalledWith({
          pathname: '/organizations/org-slug/discover/saved/1/',
          query: {editing: 'true'},
        });
      });
    });

    it('changes date correctly', async function() {
      wrapper = await createWrapper({}, true);
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {timing: {}, data: [], meta: []},
      });
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      wrapper.find('SelectorItem[value="7d"]').simulate('click');

      await tick();
      wrapper.update();
      expect(request).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            range: '7d',
            start: null,
            end: null,
            utc: null,
          }),
        })
      );

      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      wrapper.find('SelectorItem[value="24h"]').simulate('click');

      await tick();
      wrapper.update();

      // Go to New Query and try to save
      // We need this click because it updates component state :/
      wrapper
        .find('SidebarTabs .nav-tabs a')
        .first()
        .simulate('click');
      // We need to update savedQueryId because there's also logic in cWRP of container
      wrapper.setProps({
        params: {savedQueryId: undefined},
      });
      await tick();
      wrapper.update();

      wrapper.find('button[aria-label="Save"]').simulate('click');
      expect(addMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            range: '24h',
          }),
        })
      );
    });
  });

  describe('no access', function() {
    it('redirects to discover query if they have access to discover-query', function() {
      const organization = TestStubs.Organization({
        projects: [TestStubs.Project()],
        features: ['discover-query'],
      });
      const router = TestStubs.router();
      mountWithTheme(
        <DiscoverContainer
          location={{query: {}, search: ''}}
          params={{}}
          selection={{datetime: {}}}
          organization={organization}
          router={router}
        />,
        TestStubs.routerContext()
      );
      expect(router.replace).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/discover/queries/`
      );
    });

    it('redirects to discover results if they have access to discover-basic', function() {
      const organization = TestStubs.Organization({
        projects: [TestStubs.Project()],
        features: ['discover-basic'],
      });
      const router = TestStubs.router();
      mountWithTheme(
        <DiscoverContainer
          location={{query: {}, search: ''}}
          params={{}}
          selection={{datetime: {}}}
          organization={organization}
          router={router}
        />,
        TestStubs.routerContext()
      );
      expect(router.replace).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/discover/results/`
      );
    });

    it('shows no feature alert if they have no access', function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const wrapper = mountWithTheme(
        <DiscoverContainer
          location={{query: {}, search: ''}}
          params={{}}
          selection={{datetime: {}}}
          organization={organization}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper.text()).toBe("You don't have access to this feature");
    });
  });
});
