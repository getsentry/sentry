import {mount, mountWithTheme} from 'sentry-test/enzyme';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import EventView from 'app/views/eventsV2/eventView';
import {
  getFieldRenderer,
  getAggregateAlias,
  getEventTagSearchUrl,
  isAggregateField,
  decodeColumnOrder,
  pushEventViewToLocation,
} from 'app/views/eventsV2/utils';

describe('eventTagSearchUrl()', function() {
  let location;
  beforeEach(function() {
    location = {
      pathname: '/organization/org-slug/events/',
      query: {},
    };
  });

  it('adds a query', function() {
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'browser:firefox'},
    });
  });

  it('removes eventSlug', function() {
    location.query.eventSlug = 'project-slug:deadbeef';
    expect(getEventTagSearchUrl('browser', 'firefox 69', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'browser:"firefox 69"'},
    });
  });

  it('appends to an existing query', function() {
    location.query.query = 'failure';
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'failure browser:firefox'},
    });
  });
});

describe('getAggregateAlias', function() {
  it('no-ops simple fields', function() {
    expect(getAggregateAlias('field')).toEqual('field');
    expect(getAggregateAlias('under_field')).toEqual('under_field');
  });

  it('handles 0 arg functions', function() {
    expect(getAggregateAlias('count()')).toEqual('count');
    expect(getAggregateAlias('count_unique()')).toEqual('count_unique');
  });

  it('handles 1 arg functions', function() {
    expect(getAggregateAlias('count(id)')).toEqual('count_id');
    expect(getAggregateAlias('count_unique(user)')).toEqual('count_unique_user');
    expect(getAggregateAlias('count_unique(issue.id)')).toEqual('count_unique_issue_id');
  });
});

describe('getFieldRenderer', function() {
  let location, context, project, organization, data;
  beforeEach(function() {
    context = initializeOrg({
      project: TestStubs.Project(),
    });
    organization = context.organization;
    project = context.project;

    location = {
      pathname: '/events',
      query: {},
    };
    data = {
      title: 'ValueError: something bad',
      transaction: 'api.do_things',
      boolValue: 1,
      numeric: 1.23,
      createdAt: new Date(2019, 9, 3, 12, 13, 14),
      url: '/example',
      latest_event: 'deadbeef',
      'project.name': project.slug,
    };
  });

  it('can render string fields', function() {
    const renderer = getFieldRenderer('url', {url: 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));
    const link = wrapper.find('QueryLink');
    expect(link).toHaveLength(1);
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {query: 'url:/example'},
    });
    expect(link.text()).toEqual(data.url);
  });

  it('can render boolean fields', function() {
    const renderer = getFieldRenderer('boolValue', {boolValue: 'boolean'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));
    const link = wrapper.find('QueryLink');
    expect(link).toHaveLength(1);
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {query: 'boolValue:1'},
    });
  });

  it('can render integer fields', function() {
    const renderer = getFieldRenderer('numeric', {numeric: 'integer'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('Count');
    expect(value).toHaveLength(1);
    expect(value.props().value).toEqual(data.numeric);
  });

  it('can render date fields', function() {
    const renderer = getFieldRenderer('createdAt', {createdAt: 'date'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(1);
    expect(value.props().date).toEqual(data.createdAt);
  });

  it('can render null date fields', function() {
    const renderer = getFieldRenderer('nope', {nope: 'date'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(0);
    expect(wrapper.text()).toEqual('n/a');
  });

  it('can render transaction as a link', function() {
    const renderer = getFieldRenderer('transaction', {transaction: 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('OverflowLink');
    expect(value).toHaveLength(1);
    expect(value.props().to).toEqual({
      pathname: `/organizations/org-slug/eventsv2/${project.slug}:deadbeef/`,
      query: {},
    });
    expect(value.text()).toEqual(data.transaction);
  });

  it('can render title as a link', function() {
    const renderer = getFieldRenderer('title', {title: 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('OverflowLink');
    expect(value).toHaveLength(1);
    expect(value.props().to).toEqual({
      pathname: `/organizations/org-slug/eventsv2/${project.slug}:deadbeef/`,
      query: {},
    });
    expect(value.text()).toEqual(data.title);
  });

  it('can render project as an avatar', function() {
    const renderer = getFieldRenderer('project', {'project.name': 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mountWithTheme(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('ProjectBadge');
    expect(value).toHaveLength(1);
    expect(value.props().project).toEqual(project);
  });

  it('can coerce string field to a link', function() {
    const renderer = getFieldRenderer('url', {url: 'string'}, true);
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    // No basic link should be present.
    expect(wrapper.find('QueryLink')).toHaveLength(0);

    const link = wrapper.find('OverflowLink');
    expect(link.props().to).toEqual({
      pathname: `/organizations/org-slug/eventsv2/${project.slug}:deadbeef/`,
      query: {},
    });
    expect(link.text()).toEqual('/example');
  });

  it('can coerce number field to a link', function() {
    const renderer = getFieldRenderer('numeric', {numeric: 'number'}, true);
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const link = wrapper.find('OverflowLink');
    expect(link.props().to).toEqual({
      pathname: `/organizations/org-slug/eventsv2/${project.slug}:deadbeef/`,
      query: {},
    });
    expect(link.find('Count').props().value).toEqual(data.numeric);
  });

  it('can coerce date field to a link', function() {
    const renderer = getFieldRenderer('createdAt', {createdAt: 'date'}, true);
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const link = wrapper.find('OverflowLink');
    expect(link.props().to).toEqual({
      pathname: `/organizations/org-slug/eventsv2/${project.slug}:deadbeef/`,
      query: {},
    });
    expect(link.find('StyledDateTime').props().date).toEqual(data.createdAt);
  });
});

describe('decodeColumnOrder', function() {
  it('can decode 0 elements', function() {
    const results = decodeColumnOrder([]);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results).toHaveLength(0);
  });

  it('can decode fields', function() {
    const results = decodeColumnOrder([
      {field: 'title', title: 'Event title', width: 123},
    ]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'title',
      name: 'Event title',
      aggregation: '',
      field: 'title',
      width: 123,
      eventViewField: {
        field: 'title',
        title: 'Event title',
        width: 123,
      },
      isDragging: false,
      isPrimary: true,
      isSortable: false,
      type: 'string',
    });
  });

  it('can decode aggregate functions with no arguments', function() {
    const results = decodeColumnOrder([
      {field: 'count()', title: 'projects', width: 123},
    ]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'count()',
      name: 'projects',
      aggregation: 'count',
      field: '',
      width: 123,
      eventViewField: {
        field: 'count()',
        title: 'projects',
        width: 123,
      },
      isDragging: false,
      isPrimary: false,
      isSortable: true,
      type: 'never',
    });
  });

  it('can decode elements with aggregate functions with arguments', function() {
    const results = decodeColumnOrder([
      {field: 'avg(transaction.duration)', title: 'average'},
    ]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'avg(transaction.duration)',
      name: 'average',
      aggregation: 'avg',
      field: 'transaction.duration',
      width: 300,
      eventViewField: {field: 'avg(transaction.duration)', title: 'average'},
      isDragging: false,
      isPrimary: false,
      isSortable: true,
      type: 'duration',
    });
  });
});

describe('pushEventViewToLocation', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: [{field: 'count', kind: 'desc'}],
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const location = {
    query: {
      bestCountry: 'canada',
    },
  };

  it('correct query string object pushed to history', function() {
    const eventView = new EventView(state);

    pushEventViewToLocation({
      location,
      nextEventView: eventView,
    });

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: {
        id: '1234',
        name: 'best query',
        field: ['count()', 'project.id'],
        fieldnames: ['events', 'project'],
        widths: [300, 300],
        sort: ['-count'],
        tag: ['foo', 'bar'],
        query: 'event.type:error',
        project: [42],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '14d',
        environment: ['staging'],
      },
    });
  });

  it('extra query params', function() {
    const eventView = new EventView(state);

    pushEventViewToLocation({
      location,
      nextEventView: eventView,
      extraQuery: {
        cursor: 'some cursor',
      },
    });

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: {
        id: '1234',
        name: 'best query',
        field: ['count()', 'project.id'],
        fieldnames: ['events', 'project'],
        widths: [300, 300],
        sort: ['-count'],
        tag: ['foo', 'bar'],
        query: 'event.type:error',
        project: [42],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '14d',
        environment: ['staging'],
        cursor: 'some cursor',
      },
    });
  });
});

describe('isAggregateField', function() {
  it('detects aliases', function() {
    expect(isAggregateField('p888')).toBe(false);
    expect(isAggregateField('other_field')).toBe(false);
    expect(isAggregateField('p75')).toBe(true);
    expect(isAggregateField('last_seen')).toBe(true);
  });

  it('detects functions', function() {
    expect(isAggregateField('thing(')).toBe(false);
    expect(isAggregateField('count()')).toBe(true);
    expect(isAggregateField('unique_count(user)')).toBe(true);
  });
});
