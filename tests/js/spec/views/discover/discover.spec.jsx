import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import Discover from 'app/views/discover/discover';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import createQueryBuilder from 'app/views/discover/queryBuilder';

describe('Discover', function () {
  let organization, project, queryBuilder, routerContext;
  beforeEach(function () {
    ({organization, project, routerContext} = initializeOrg());

    queryBuilder = createQueryBuilder({}, organization);
    GlobalSelectionStore.reset();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/saved/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/',
      method: 'POST',
      body: {
        data: [],
        timing: {},
        meta: [],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
      method: 'POST',
      body: {
        data: [],
        timing: {},
        meta: [],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('componentDidMount()', function () {
    let wrapper, mockResponse;
    beforeEach(function () {
      mockResponse = {
        timing: {},
        data: [{foo: 'bar', 'project.id': project.id}],
        meta: [{name: 'foo'}],
      };
      queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));
    });

    it('auto-runs saved query after tags are loaded', async function () {
      const savedQuery = TestStubs.DiscoverSavedQuery();
      const params = {savedQueryId: savedQuery.id, orgId: organization.slug};
      wrapper = mountWithTheme(
        <Discover
          location={{query: {}}}
          queryBuilder={queryBuilder}
          organization={organization}
          savedQuery={savedQuery}
          params={params}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading
        />,
        routerContext
      );
      await tick();
      expect(wrapper.state().data.baseQuery.query).toBe(null);
      expect(wrapper.state().data.baseQuery.data).toBe(null);
      wrapper.setProps({isLoading: false});
      await tick();
      expect(wrapper.state().data.baseQuery.query).toEqual(queryBuilder.getExternal());
      expect(wrapper.state().data.baseQuery.data).toEqual(
        expect.objectContaining({data: mockResponse.data})
      );
    });

    it('auto-runs when there is a query string after tags are loaded', async function () {
      wrapper = mountWithTheme(
        <Discover
          location={{
            query: {},
            search:
              'projects=%5B%5D&fields=%5B%22id%22%2C%22issue.id%22%2C%22project.name%22%2C%22platform%22%2C%22timestamp%22%5D&conditions=%5B%5D&aggregations=%5B%5D&range=%227d%22&orderby=%22-timestamp%22&limit=1000&start=null&end=null',
          }}
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading
        />,
        routerContext
      );
      await tick();
      expect(wrapper.state().data.baseQuery.query).toBe(null);
      expect(wrapper.state().data.baseQuery.data).toBe(null);
      wrapper.setProps({isLoading: false});
      await tick();
      expect(wrapper.state().data.baseQuery.query).toEqual(queryBuilder.getExternal());
      expect(wrapper.state().data.baseQuery.data).toEqual(
        expect.objectContaining({data: mockResponse.data})
      );
    });

    it('does not auto run when there is no query string', async function () {
      wrapper = mountWithTheme(
        <Discover
          location={{
            query: {},
            search: '',
          }}
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
      await tick();
      expect(wrapper.state().data.baseQuery.query).toBe(null);
      expect(wrapper.state().data.baseQuery.data).toBe(null);
    });
  });

  describe('componentWillReceiveProps()', function () {
    it('handles navigating to saved query', function () {
      const wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          location={{query: {}, search: ''}}
          params={{}}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
      expect(wrapper.find('NewQuery')).toHaveLength(1);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(0);
      const savedQuery = TestStubs.DiscoverSavedQuery();
      wrapper.setProps({
        savedQuery,
        params: {savedQueryId: savedQuery.id},
        isEditingSavedQuery: true,
      });
      wrapper.update();
      expect(wrapper.find('NewQuery')).toHaveLength(0);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(1);
    });

    it('handles navigating to new date', async function () {
      const params = {orgId: organization.slug};
      const wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          location={{query: {}, search: ''}}
          params={params}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );

      expect(wrapper.find('TimeRangeSelector').text()).toEqual('Last 14 days');
      wrapper.setProps({
        location: {
          query: {},
          search:
            'projects=%5B%5D&fields=%5B%22id%22%2C%22issue.id%22%2C%22project.name%22%2C%22platform%22%2C%22timestamp%22%5D&conditions=%5B%5D&aggregations=%5B%5D&range=%227d%22&orderby=%22-timestamp%22&limit=1000&start=null&end=null',
        },
      });
      await tick();
      wrapper.update();
      expect(wrapper.find('TimeRangeSelector').text()).toEqual('Last 7 days');

      // TODO: check that query is run with correct params
    });
  });

  describe('Pagination', function () {
    let wrapper, firstPageMock, secondPageMock;

    beforeEach(function () {
      firstPageMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {timing: {}, data: [], meta: []},
        headers: {
          Link:
            '<api/0/organizations/sentry/discover/query/?per_page=2&cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1", <api/0/organizations/sentry/discover/query/?per_page=1000&cursor=0:2:0>; rel="next"; results="true"; cursor="0:1000:0"',
        },
      });

      secondPageMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:1000:0',
        method: 'POST',
        body: {timing: {}, data: [], meta: []},
      });

      wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          params={{}}
          location={{query: {}, search: ''}}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
    });

    it('can go to next page', async function () {
      wrapper.instance().runQuery();
      await tick();
      wrapper.update();
      wrapper.find('Pagination').find('Button').at(1).simulate('click');
      expect(firstPageMock).toHaveBeenCalledTimes(1);
      expect(secondPageMock).toHaveBeenCalledTimes(1);
    });

    it("can't go back", async function () {
      wrapper.instance().runQuery();
      await tick();
      wrapper.update();
      expect(wrapper.find('Pagination').find('Button').at(0).prop('disabled')).toBe(true);
      wrapper.find('Pagination').find('Button').at(0).simulate('click');
      expect(firstPageMock).toHaveBeenCalledTimes(1);
    });

    it('does not paginate on aggregate', async function () {
      wrapper.instance().updateField('aggregations', [['count()', null, 'count']]);
      wrapper.instance().runQuery();
      await tick();
      wrapper.update();
      expect(wrapper.find('Pagination').exists()).toBe(false);
    });
  });

  describe('runQuery()', function () {
    const mockResponse = {timing: {}, data: [], meta: []};
    let wrapper;
    beforeEach(function () {
      queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));
      queryBuilder.fetchWithoutLimit = jest.fn(() => Promise.resolve(mockResponse));

      wrapper = mountWithTheme(
        <Discover
          params={{}}
          location={{query: {}, search: ''}}
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
    });

    it('runs basic query', async function () {
      const query = {...queryBuilder.getExternal()};
      query.fields = [...queryBuilder.getExternal().fields, 'project.id'];

      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.fetch).toHaveBeenCalledWith(query);
      expect(wrapper.state().data.baseQuery.data).toEqual(mockResponse);
    });

    it('requests project.id if id is also requested', async function () {
      queryBuilder.updateField('fields', ['message', 'id']);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: ['message', 'id', 'project.id'],
        })
      );
      expect(wrapper.state().data.baseQuery.data).toEqual(mockResponse);
    });

    it('removes incomplete conditions', async function () {
      queryBuilder.updateField('conditions', [[], []]);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getExternal().conditions).toEqual([]);
    });

    it('removes incomplete aggregations', async function () {
      queryBuilder.updateField('aggregations', [[], []]);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getExternal().aggregations).toEqual([]);
    });

    it('also runs chart query if there are aggregations', async function () {
      wrapper.instance().updateField('fields', []);
      wrapper.instance().updateField('aggregations', [['count()', null, 'count']]);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledWith(queryBuilder.getExternal());
      expect(queryBuilder.fetchWithoutLimit).toHaveBeenCalledWith({
        ...queryBuilder.getExternal(),
        groupby: ['time'],
        rollup: 60 * 60 * 24,
        orderby: '-time',
        limit: 5000,
      });
    });
  });

  describe('saveQuery()', function () {
    it('can be saved', function () {
      const wrapper = mountWithTheme(
        <Discover
          params={{}}
          location={{query: {}, search: ''}}
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
      const createMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/',
        method: 'POST',
      });

      wrapper.find('button[aria-label="Save"]').simulate('click');

      expect(createMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/saved/',
        expect.objectContaining({
          data: expect.objectContaining(queryBuilder.getInternal()),
        })
      );
    });
  });

  describe('reset()', function () {
    describe('query builder (no saved query)', function () {
      let wrapper;
      beforeEach(function () {
        const mockResponse = {timing: {}, data: [], meta: []};
        browserHistory.push.mockImplementation(function ({search}) {
          wrapper.setProps({
            location: {
              query: {},
              search: search || '',
            },
          });
        });

        queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));
        queryBuilder.reset = jest.fn(queryBuilder.reset);

        wrapper = mountWithTheme(
          <Discover
            queryBuilder={queryBuilder}
            organization={organization}
            location={{
              location: '?fields=something',
              query: {fields: 'something'},
              search: '?fields=something',
            }}
            params={{}}
            updateSavedQueryData={jest.fn()}
            toggleEditMode={jest.fn()}
            isLoading={false}
          />,
          routerContext
        );

        wrapper.instance().updateField('fields', ['message']);
        wrapper.instance().updateField('orderby', 'id');
        wrapper.instance().updateField('limit', 5);
        wrapper.instance().runQuery();
        wrapper.update();
      });

      it('resets query builder and state', function () {
        wrapper.instance().reset();
        expect(queryBuilder.reset).toHaveBeenCalled();
        const {
          data: {baseQuery, byDayQuery},
        } = wrapper.instance().state;
        expect(baseQuery.query).toBeNull();
        expect(baseQuery.data).toBeNull();
        expect(byDayQuery.query).toBeNull();
        expect(byDayQuery.data).toBeNull();
      });

      it('resets "fields"', function () {
        const fields = wrapper.find('SelectControl[name="fields"]');
        expect(fields.text()).toContain('message');
        wrapper.instance().reset();
        expect(fields.text()).not.toContain('message');
        expect(fields.text()).toContain('id');
      });

      it('resets "orderby"', function () {
        expect(wrapper.find('SelectControl[name="orderbyDirection"]').text()).toBe('asc');
        expect(wrapper.find('SelectControl[name="orderbyField"]').text()).toBe('id');
        wrapper.instance().reset();
        wrapper.update();
        expect(wrapper.find('SelectControl[name="orderbyDirection"]').text()).toBe(
          'desc'
        );
        expect(wrapper.find('SelectControl[name="orderbyField"]').text()).toBe(
          'timestamp'
        );
      });

      it('resets "limit"', function () {
        expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(5);
        wrapper.instance().reset();
        wrapper.update();
        expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(1000);
      });

      it('does not reset if location.search is empty', function () {
        const prevCallCount = queryBuilder.reset.mock.calls.length;
        wrapper.setProps({
          location: {
            query: {},
            search: '?fields=[]',
          },
        });
        expect(queryBuilder.reset.mock.calls).toHaveLength(prevCallCount);
      });
    });
  });

  describe('Saved query', function () {
    let wrapper, deleteMock, updateMock;
    beforeEach(function () {
      const savedQuery = TestStubs.DiscoverSavedQuery();
      wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          savedQuery={savedQuery}
          params={{savedQueryId: savedQuery.id}}
          updateSavedQueryData={jest.fn()}
          view="saved"
          location={{
            query: {},
            search: '',
          }}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );

      deleteMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        method: 'DELETE',
      });

      updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/saved/1/',
        method: 'PUT',
      });
    });

    it('resets saved query', function () {
      wrapper.instance().updateField('fields', ['message']);
      wrapper.instance().runQuery();
      wrapper.update();
      expect(queryBuilder.getInternal().fields).toEqual(['message']);
      wrapper.instance().reset();
      wrapper.update();
      expect(queryBuilder.getInternal().fields).toEqual(['test']);
    });

    it('toggles edit mode', function () {
      wrapper.setProps({
        isEditingSavedQuery: true,
      });
      expect(wrapper.find('SavedQueryList')).toHaveLength(1);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(1);
      wrapper.find('SavedQueryAction').find('a').simulate('click');
      expect(wrapper.find('SavedQueryList')).toHaveLength(1);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(1);
    });

    it('delete saved query', function () {
      wrapper.setProps({
        isEditingSavedQuery: true,
      });
      wrapper.find('SavedQueryAction[data-test-id="delete"]').simulate('click');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('update name', function () {
      wrapper.setProps({
        isEditingSavedQuery: true,
      });

      wrapper
        .find('input[id="id-name"]')
        .simulate('change', {target: {value: 'New name'}});

      wrapper.find('button[aria-label="Save"]').simulate('click');

      expect(updateMock).toHaveBeenCalledWith(
        '/organizations/org-slug/discover/saved/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New name',
          }),
        })
      );
    });
  });

  describe('Intro', function () {
    let wrapper;

    beforeEach(function () {
      wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          location={{
            query: {},
            search: '?fields=something',
          }}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );

      const mockResponse = Promise.resolve({timing: {}, data: [], meta: []});
      queryBuilder.fetch = jest.fn(() => mockResponse);
      queryBuilder.fetchWithoutLimit = jest.fn(() => mockResponse);
    });

    it('renders example queries', function () {
      const queries = wrapper.find('IntroContainer').find('ExampleQuery');
      expect(queries).toHaveLength(3);
      expect(queries.first().text()).toContain('Events by stack filename');
    });

    it('runs example query', function () {
      expect(queryBuilder.fetch).not.toHaveBeenCalled();
      wrapper
        .find('IntroContainer')
        .find('ExampleQuery')
        .first()
        .find('Button')
        .simulate('click');
      const query = queryBuilder.getInternal();
      expect(query.fields).toEqual(['stack.filename']);
      expect(query.aggregations).toEqual([['count()', null, 'count']]);
      expect(query.conditions).toEqual([]);
      expect(queryBuilder.fetch).toHaveBeenCalled();
      expect(queryBuilder.fetchWithoutLimit).toHaveBeenCalled();
    });
  });

  describe('toggleSidebar()', function () {
    let wrapper;
    beforeEach(function () {
      browserHistory.push.mockImplementation(function ({search}) {
        wrapper.setProps({
          location: {
            query: {},
            search: search || '',
          },
        });
      });

      wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          location={{
            query: {},
          }}
          params={{}}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
    });

    it('toggles sidebar', function () {
      expect(wrapper.find('QueryFields')).toHaveLength(1);
      expect(wrapper.find('SavedQueries')).toHaveLength(0);
      wrapper.find('SidebarTabs').find('a').at(1).simulate('click');
      expect(wrapper.find('QueryFields')).toHaveLength(0);
      expect(wrapper.find('SavedQueries')).toHaveLength(1);
    });
  });

  describe('Time Selector', function () {
    let wrapper;
    let query;

    beforeEach(function () {
      const config = ConfigStore.getConfig();
      ConfigStore.loadInitialData({
        ...config,
        user: {
          ...config.user,
          options: {...config.user.options, timezone: 'America/New_York'},
        },
      });
      GlobalSelectionStore.reset();

      query = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {timing: {}, data: [], meta: []},
      });

      wrapper = mountWithTheme(
        <Discover
          queryBuilder={queryBuilder}
          params={{}}
          location={routerContext.context.location}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        routerContext
      );
    });

    it('changes to absolute date', async function () {
      await wrapper.instance().runQuery();
      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            range: '14d',
          }),
        })
      );

      query.mockClear();

      // Select absolute date
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

      expect(query).not.toHaveBeenCalled();

      // Hide date picker
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await tick();

      // Should make request for the last 14 days as an absolute date range
      // Current time in EST is '2017-10-16T22:41:20'
      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-03T02:41:20.000',
            end: '2017-10-17T02:41:20.000',
            utc: false,
          }),
        })
      );
    });

    it('switches between UTC and local dates', async function () {
      // Select absolute date
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      wrapper.find('SelectorItem[value="absolute"]').simulate('click');

      // Select a single day
      wrapper.find('DayCell').at(0).simulate('mouseUp');

      // Hide date picker
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await wrapper.update();

      // Should make request for the last day an absolute date range
      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-01T04:00:00.000',
            end: '2017-10-02T03:59:59.000',
            utc: false,
          }),
        })
      );

      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      // Switch to UTC
      wrapper.find('UtcPicker Checkbox').simulate('change');
      // Hide dropdown
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      await wrapper.update();

      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-01T00:00:00.000',
            end: '2017-10-01T23:59:59.000',
            utc: true,
          }),
        })
      );

      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      // Switch from UTC
      wrapper.find('UtcPicker Checkbox').simulate('change');
      // Hide dropdown
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-01T04:00:00.000',
            end: '2017-10-02T03:59:59.000',
            utc: false,
          }),
        })
      );
    });
  });
});
