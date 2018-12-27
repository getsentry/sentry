import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import Discover from 'app/views/organizationDiscover/discover';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';

describe('Discover', function() {
  describe('runQuery()', function() {
    const mockResponse = {timing: {}, data: [], meta: []};
    let wrapper, queryBuilder;
    beforeEach(function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      queryBuilder = createQueryBuilder({}, organization);
      queryBuilder.fetch = jest.fn(() => Promise.resolve(mockResponse));

      wrapper = mount(
        <Discover queryBuilder={queryBuilder} organization={organization} />,
        TestStubs.routerContext()
      );
    });

    it('runs basic query', async function() {
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.fetch).toHaveBeenCalledWith(queryBuilder.getExternal());
      expect(wrapper.state().data).toEqual(mockResponse);
    });

    it('always requests event_id and project_id for basic queries', async function() {
      queryBuilder.updateField('fields', ['message']);
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.fetch).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: ['message', 'event_id', 'project_id'],
        })
      );
      expect(wrapper.state().data).toEqual(mockResponse);
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

  describe('reset()', function() {
    let wrapper, queryBuilder;
    beforeEach(function() {
      browserHistory.push.mockImplementation(function(url) {
        wrapper.setProps({
          location: {
            search: url.pathname.replace('/organizations/org-slug/discover/', ''),
            action: 'PUSH',
          },
        });
      });

      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      queryBuilder = createQueryBuilder({}, organization);
      queryBuilder.fetch = jest.fn(() => Promise.resolve());
      queryBuilder.reset = jest.fn(queryBuilder.reset);

      wrapper = mount(
        <Discover
          queryBuilder={queryBuilder}
          organization={organization}
          location={{location: '?fields=something'}}
        />,
        TestStubs.routerContext()
      );

      wrapper.instance().updateField('fields', ['message']);
      wrapper.instance().updateField('orderby', 'event_id');
      wrapper.instance().updateField('limit', 5);

      wrapper.instance().runQuery();
      wrapper.update();
    });

    it('resets query builder and state', function() {
      wrapper.instance().reset();
      expect(queryBuilder.reset).toHaveBeenCalled();
      const {data, query, chartData, chartQuery} = wrapper.instance().state;
      expect(data).toBeNull();
      expect(query).toBeNull();
      expect(chartData).toBeNull();
      expect(chartQuery).toBeNull();
    });

    it('resets "fields"', function() {
      const fields = wrapper.find('SelectControl[name="fields"]');
      expect(fields.text()).toContain('message');
      wrapper.instance().reset();
      expect(fields.text()).toContain('No fields selected');
    });

    it('resets "orderby"', function() {
      expect(wrapper.find('SelectControl[name="orderby"]').text()).toBe('event_id asc');
      wrapper.instance().reset();
      wrapper.update();
      expect(wrapper.find('SelectControl[name="orderby"]').text()).toBe('timestamp desc');
    });

    it('resets "limit"', function() {
      expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(5);
      wrapper.instance().reset();
      wrapper.update();
      expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(1000);
    });

    it('does not reset on location replace', function() {
      const prevCallCount = queryBuilder.reset.mock.calls.length;
      wrapper.setProps({
        location: {
          search: '?fields=[]',
          action: 'REPLACE',
        },
      });
      expect(queryBuilder.reset.mock.calls).toHaveLength(prevCallCount);
    });
  });
});
