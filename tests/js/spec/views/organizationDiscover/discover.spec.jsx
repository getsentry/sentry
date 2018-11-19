import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import Discover from 'app/views/organizationDiscover/discover';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Discover', function() {
  let organization, project, queryBuilder;
  beforeEach(function() {
    project = TestStubs.Project();
    organization = TestStubs.Organization({projects: [project]});
    queryBuilder = createQueryBuilder({}, organization);
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('componentDidMount()', function() {
    let wrapper, mockResponse;
    beforeEach(function() {
      mockResponse = {
        timing: {},
        data: [{foo: 'bar', 'project.id': project.id}],
        meta: [{name: 'foo'}],
      };
      queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));
    });

    it('auto-runs saved query', async function() {
      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          savedQuery={TestStubs.DiscoverSavedQuery()}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext([{organization}])
      );
      await tick();
      expect(wrapper.state().data.baseQuery.query).toEqual(queryBuilder.getExternal());
      expect(wrapper.state().data.baseQuery.data).toEqual(
        expect.objectContaining({data: mockResponse.data})
      );
    });

    it('does not auto run non-saved query', async function() {
      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext([{organization}])
      );
      await tick();
      expect(wrapper.state().data.baseQuery.query).toBe(null);
      expect(wrapper.state().data.baseQuery.data).toBe(null);
    });
  });

  describe('componentWillRecieveProps()', function() {
    it('handles navigating to saved query', function() {
      const wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          location={{search: ''}}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext([{organization}])
      );
      expect(wrapper.find('NewQuery')).toHaveLength(1);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(0);
      wrapper.setProps({
        savedQuery: TestStubs.DiscoverSavedQuery(),
        isEditingSavedQuery: true,
      });
      wrapper.update();
      expect(wrapper.find('NewQuery')).toHaveLength(0);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(1);
    });
  });

  describe('Pagination', function() {
    let wrapper, firstPageMock, secondPageMock;

    beforeEach(function() {
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

      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          params={{}}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext()
      );
    });

    it('can go to next page', async function() {
      wrapper.instance().runQuery();
      await tick();
      wrapper.update();
      wrapper
        .find('PaginationButtons')
        .find('Button')
        .at(1)
        .simulate('click');
      expect(firstPageMock).toHaveBeenCalledTimes(1);
      expect(secondPageMock).toHaveBeenCalledTimes(1);
    });

    it("can't go back", async function() {
      wrapper.instance().runQuery();
      await tick();
      wrapper.update();
      expect(
        wrapper
          .find('PaginationButtons')
          .find('Button')
          .at(0)
          .prop('disabled')
      ).toBe(true);
      wrapper
        .find('PaginationButtons')
        .find('Button')
        .at(0)
        .simulate('click');
      expect(firstPageMock).toHaveBeenCalledTimes(1);
    });

    it('does not paginate on aggregate', async function() {
      wrapper.instance().updateField('aggregations', [['count()', null, 'count']]);
      wrapper.instance().runQuery();
      await tick();
      wrapper.update();
      expect(wrapper.find('Pagination').exists()).toBe(false);
    });
  });

  describe('runQuery()', function() {
    const mockResponse = {timing: {}, data: [], meta: []};
    let wrapper;
    beforeEach(function() {
      queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));

      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext()
      );
    });

    it('runs basic query', async function() {
      const query = {...queryBuilder.getExternal()};
      query.fields = [...queryBuilder.getExternal().fields, 'project.id'];

      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.fetch).toHaveBeenCalledWith(query);
      expect(wrapper.state().data.baseQuery.data).toEqual(mockResponse);
    });

    it('always requests id and project.id for basic queries', async function() {
      queryBuilder.updateField('fields', ['message']);
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

    it('removes incomplete conditions', async function() {
      queryBuilder.updateField('conditions', [[], []]);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getExternal().conditions).toEqual([]);
    });

    it('removes incomplete aggregations', async function() {
      queryBuilder.updateField('aggregations', [[], []]);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.getExternal().aggregations).toEqual([]);
    });

    it('also runs chart query if there are aggregations', async function() {
      wrapper.instance().updateField('aggregations', [['count()', null, 'count']]);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(2);
      expect(queryBuilder.fetch).toHaveBeenNthCalledWith(1, queryBuilder.getExternal());
      expect(queryBuilder.fetch).toHaveBeenNthCalledWith(2, {
        ...queryBuilder.getExternal(),
        groupby: ['time'],
        rollup: 60 * 60 * 24,
        orderby: 'time',
      });
    });
  });

  describe('saveQuery()', function() {
    it('can be saved', function() {
      const wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext()
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

  describe('reset()', function() {
    describe('query builder (no saved query)', function() {
      let wrapper;
      beforeEach(function() {
        const mockResponse = {timing: {}, data: [], meta: []};
        browserHistory.push.mockImplementation(function({search}) {
          wrapper.setProps({
            location: {
              search: search || '',
            },
          });
        });

        queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));
        queryBuilder.reset = jest.fn(queryBuilder.reset);

        wrapper = mount(
          <Discover
            queryBuilder={queryBuilder}
            organization={organization}
            location={{location: '?fields=something'}}
            updateSavedQueryData={jest.fn()}
            toggleEditMode={jest.fn()}
            isLoading={false}
          />,
          TestStubs.routerContext()
        );

        wrapper.instance().updateField('fields', ['message']);
        wrapper.instance().updateField('orderby', 'id');
        wrapper.instance().updateField('limit', 5);

        wrapper.instance().runQuery();
        wrapper.update();
      });

      it('resets query builder and state', function() {
        wrapper.instance().reset();
        expect(queryBuilder.reset).toHaveBeenCalled();
        const {data: {baseQuery, byDayQuery}} = wrapper.instance().state;
        expect(baseQuery.query).toBeNull();
        expect(baseQuery.data).toBeNull();
        expect(byDayQuery.query).toBeNull();
        expect(byDayQuery.data).toBeNull();
      });

      it('resets "fields"', function() {
        const fields = wrapper.find('SelectControl[name="fields"]');
        expect(fields.text()).toContain('message');
        wrapper.instance().reset();
        expect(fields.text()).not.toContain('message');
        expect(fields.text()).toContain('id');
      });

      it('resets "orderby"', function() {
        expect(wrapper.find('SelectControl[name="orderby"]').text()).toBe('id asc');
        wrapper.instance().reset();
        wrapper.update();
        expect(wrapper.find('SelectControl[name="orderby"]').text()).toBe(
          'timestamp desc'
        );
      });

      it('resets "limit"', function() {
        expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(5);
        wrapper.instance().reset();
        wrapper.update();
        expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(1000);
      });

      it('does not reset if location.search is empty', function() {
        const prevCallCount = queryBuilder.reset.mock.calls.length;
        wrapper.setProps({
          location: {
            search: '?fields=[]',
          },
        });
        expect(queryBuilder.reset.mock.calls).toHaveLength(prevCallCount);
      });
    });
  });

  describe('Saved query', function() {
    let wrapper, deleteMock, updateMock;
    beforeEach(function() {
      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          savedQuery={TestStubs.DiscoverSavedQuery()}
          updateSavedQueryData={jest.fn()}
          view="saved"
          location={{search: ''}}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext()
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

    it('resets saved query', function() {
      wrapper.instance().updateField('fields', ['message']);
      wrapper.instance().runQuery();
      wrapper.update();
      expect(queryBuilder.getInternal().fields).toEqual(['message']);
      wrapper.instance().reset();
      wrapper.update();
      expect(queryBuilder.getInternal().fields).toEqual(['test']);
    });

    it('toggles edit mode', function() {
      wrapper.setProps({
        isEditingSavedQuery: true,
      });
      expect(wrapper.find('SavedQueryList')).toHaveLength(1);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(1);
      wrapper
        .find('SavedQueryAction')
        .find('a')
        .simulate('click');
      expect(wrapper.find('SavedQueryList')).toHaveLength(1);
      expect(wrapper.find('EditSavedQuery')).toHaveLength(1);
    });

    it('delete saved query', function() {
      wrapper.setProps({
        isEditingSavedQuery: true,
      });
      wrapper.find('SavedQueryAction[data-test-id="delete"]').simulate('click');
      expect(deleteMock).toHaveBeenCalled();
    });

    it('update name', function() {
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

  describe('Intro', function() {
    let wrapper;

    beforeEach(function() {
      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          location={{location: '?fields=something'}}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext()
      );
    });
    it('renders example queries', function() {
      const queries = wrapper.find('IntroContainer').find('li');
      expect(queries).toHaveLength(3);
      expect(queries.first().text()).toBe('Last 10 event IDs');
    });

    it('updates query builder when clicked', function() {
      const queries = wrapper.find('IntroContainer').find('li');
      queries
        .first()
        .find('a')
        .simulate('click');

      const query = queryBuilder.getInternal();
      expect(query.fields).toEqual(['id']);
      expect(query.limit).toEqual(10);
    });
  });

  describe('toggleSidebar()', function() {
    let wrapper;
    beforeEach(function() {
      browserHistory.push.mockImplementation(function({search}) {
        wrapper.setProps({
          location: {
            search: search || '',
          },
        });
      });

      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          location={{location: ''}}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext()
      );
    });

    it('toggles sidebar', function() {
      expect(wrapper.find('QueryFields')).toHaveLength(1);
      expect(wrapper.find('SavedQueries')).toHaveLength(0);
      wrapper
        .find('SidebarTabs')
        .find('a')
        .at(1)
        .simulate('click');
      expect(wrapper.find('QueryFields')).toHaveLength(0);
      expect(wrapper.find('SavedQueries')).toHaveLength(1);
    });
  });

  describe('Time Selector', function() {
    let wrapper;
    let query;

    beforeEach(function() {
      query = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/discover/query/?per_page=1000&cursor=0:0:1',
        method: 'POST',
        body: {timing: {}, data: [], meta: []},
      });
      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          updateSavedQueryData={jest.fn()}
          toggleEditMode={jest.fn()}
          isLoading={false}
        />,
        TestStubs.routerContext([{organization}])
      );
    });

    it('changes to absolute date', async function() {
      await wrapper.instance().runQuery();
      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            range: '14d',
          }),
        })
      );

      // Select absolute date
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      wrapper.find('SelectorItem[value="absolute"]').simulate('click');

      // Hide date picker
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      // Should make request for the last 14 days as an absolute date range
      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-03T02:41:20',
            end: '2017-10-17T02:41:20',
          }),
        })
      );
    });

    it('switches between UTC and local dates', async function() {
      // Select absolute date
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');
      wrapper.find('SelectorItem[value="absolute"]').simulate('click');

      // Select a single day
      wrapper
        .find('DayCell')
        .at(0)
        .simulate('mouseUp');

      // Hide date picker
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      // Should make request for the last 14 days as an absolute date range
      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-01T00:00:00',
            end: '2017-10-01T23:59:59',
          }),
        })
      );

      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      // Switch to UTC
      wrapper.find('UtcPicker Checkbox').simulate('change');
      // Hide dropdown
      wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

      expect(query).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2017-10-01T04:00:00',
            end: '2017-10-02T03:59:59',
          }),
        })
      );
    });
  });
});
