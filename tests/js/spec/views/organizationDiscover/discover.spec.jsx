import React from 'react';
import {mount} from 'enzyme';

import Discover from 'app/views/organizationDiscover/discover';
import createQueryBuilder from 'app/views/organizationDiscover/queryBuilder';
import {COLUMNS} from 'app/views/organizationDiscover/data';

describe('Discover', function() {
  describe('getOrderbyOptions()', function() {
    let wrapper;

    beforeEach(function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      const queryBuilder = createQueryBuilder({}, organization);

      wrapper = mount(
        <Discover queryBuilder={queryBuilder} organization={organization} />,
        TestStubs.routerContext()
      );
    });

    it('allows ordering by all fields when no aggregations', function() {
      expect(wrapper.instance().getOrderbyOptions()).toHaveLength(COLUMNS.length * 2);
    });

    it('allows ordering by aggregations with aggregations and no fields', function() {
      wrapper.instance().updateField('aggregations', [['count()', null, 'count']]);
      const options = wrapper.instance().getOrderbyOptions();
      expect(options).toHaveLength(2);
      expect(options).toEqual([
        {label: 'count asc', value: 'count'},
        {label: 'count desc', value: '-count'},
      ]);
    });

    it('allows ordering by aggregations and fields', function() {
      wrapper.instance().updateField('fields', ['message']);
      wrapper.instance().updateField('aggregations', [['count()', null, 'count']]);
      const options = wrapper.instance().getOrderbyOptions();
      expect(options).toHaveLength(4);
      expect(options).toEqual([
        {label: 'message asc', value: 'message'},
        {label: 'message desc', value: '-message'},
        {label: 'count asc', value: 'count'},
        {label: 'count desc', value: '-count'},
      ]);
    });
  });

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

    it('runs query', async function() {
      wrapper.instance().runQuery();
      await tick();
      expect(queryBuilder.fetch).toHaveBeenCalledTimes(1);
      expect(queryBuilder.fetch).toHaveBeenCalledWith();
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
      expect(queryBuilder.fetch).toHaveBeenNthCalledWith(1);
      expect(queryBuilder.fetch).toHaveBeenNthCalledWith(2, {
        ...queryBuilder.getExternal(),
        groupby: ['time'],
        rollup: 60 * 60 * 24,
        orderby: 'time',
      });
    });
  });

  describe('reset', function() {
    let wrapper, queryBuilder;
    beforeEach(function() {
      const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
      queryBuilder = createQueryBuilder({}, organization);
      queryBuilder.fetch = jest.fn(() => Promise.resolve());

      wrapper = mount(
        <Discover queryBuilder={queryBuilder} organization={organization} />,
        TestStubs.routerContext()
      );

      wrapper.instance().updateField('fields', ['message']);
      wrapper.instance().updateField('orderby', 'event_id');
      wrapper.instance().updateField('limit', 5);

      wrapper.instance().runQuery();
      wrapper.update();
    });

    it('resets "fields"', function() {
      const fields = wrapper.find('SelectControl[name="fields"]');
      expect(fields.text()).toContain('message');
      wrapper.instance().reset();
      expect(fields.text()).toContain('No fields selected');
    });

    it('resets "orderby"', function() {
      expect(wrapper.find('SelectField[name="orderby"]').prop('value')).toBe('event_id');
      wrapper.instance().reset();
      wrapper.update();
      expect(wrapper.find('SelectField[name="orderby"]').prop('value')).toBe(
        '-timestamp'
      );
    });

    it('resets "limit"', function() {
      expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(5);
      wrapper.instance().reset();
      wrapper.update();
      expect(wrapper.find('NumberField[name="limit"]').prop('value')).toBe(1000);
    });
  });
});
