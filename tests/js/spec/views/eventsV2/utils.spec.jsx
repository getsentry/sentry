import {mount, mountWithTheme} from 'sentry-test/enzyme';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import EventView from 'app/views/eventsV2/eventView';
import {
  getAggregateAlias,
  isAggregateField,
  decodeColumnOrder,
  pushEventViewToLocation,
  getExpandedResults,
  getFieldRenderer,
  getDiscoverLandingUrl,
  explodeField,
  hasAggregateField,
} from 'app/views/eventsV2/utils';
import {COL_WIDTH_UNDEFINED, COL_WIDTH_NUMBER} from 'app/components/gridEditable';

describe('getAggregateAlias', function() {
  it('no-ops simple fields', function() {
    expect(getAggregateAlias('field')).toEqual('field');
    expect(getAggregateAlias('under_field')).toEqual('under_field');
    expect(getAggregateAlias('foo.bar.is-Enterprise_42')).toEqual(
      'foo.bar.is-Enterprise_42'
    );
  });

  it('handles 0 arg functions', function() {
    expect(getAggregateAlias('count()')).toEqual('count');
    expect(getAggregateAlias('count_unique()')).toEqual('count_unique');
  });

  it('handles 1 arg functions', function() {
    expect(getAggregateAlias('count(id)')).toEqual('count_id');
    expect(getAggregateAlias('count_unique(user)')).toEqual('count_unique_user');
    expect(getAggregateAlias('count_unique(issue.id)')).toEqual('count_unique_issue_id');
    expect(getAggregateAlias('count(foo.bar.is-Enterprise_42)')).toEqual(
      'count_foo_bar_is-Enterprise_42'
    );
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
    const text = wrapper.find('Container');
    expect(text.text()).toEqual(data.url);
  });

  it('can render boolean fields', function() {
    const renderer = getFieldRenderer('boolValue', {boolValue: 'boolean'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));
    const text = wrapper.find('Container');
    expect(text.text()).toEqual('yes');
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
});

describe('decodeColumnOrder', function() {
  it('can decode 0 elements', function() {
    const results = decodeColumnOrder([]);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results).toHaveLength(0);
  });

  it('can decode fields', function() {
    const results = decodeColumnOrder([{field: 'title', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'title',
      name: 'title',
      aggregation: '',
      field: 'title',
      width: 123,
      eventViewField: {
        field: 'title',
        width: 123,
      },
      isDragging: false,
      isSortable: false,
      type: 'string',
    });
  });

  it('can decode aggregate functions with no arguments', function() {
    let results = decodeColumnOrder([{field: 'count()', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results[0]).toEqual({
      key: 'count()',
      name: 'count()',
      aggregation: 'count',
      field: '',
      width: 123,
      eventViewField: {
        field: 'count()',
        width: 123,
      },
      isDragging: false,
      isSortable: true,
      type: 'number',
    });

    results = decodeColumnOrder([{field: 'p75()', width: 123}]);
    expect(results[0].type).toEqual('duration');

    results = decodeColumnOrder([{field: 'p99()', width: 123}]);
    expect(results[0].type).toEqual('duration');
  });

  it('can decode elements with aggregate functions with arguments', function() {
    const results = decodeColumnOrder([{field: 'avg(transaction.duration)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'avg(transaction.duration)',
      name: 'avg(transaction.duration)',
      aggregation: 'avg',
      field: 'transaction.duration',
      width: COL_WIDTH_NUMBER,
      eventViewField: {field: 'avg(transaction.duration)'},
      isDragging: false,
      isSortable: true,
      type: 'duration',
    });
  });
});

describe('pushEventViewToLocation', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: [{field: 'count', kind: 'desc'}],
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
        widths: [COL_WIDTH_UNDEFINED, COL_WIDTH_UNDEFINED],
        sort: ['-count'],
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
        widths: [COL_WIDTH_UNDEFINED, COL_WIDTH_UNDEFINED],
        sort: ['-count'],
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
    expect(isAggregateField('foo.bar.is-Enterprise_42')).toBe(false);
    expect(isAggregateField('p75')).toBe(true);
    expect(isAggregateField('last_seen')).toBe(true);
  });

  it('detects functions', function() {
    expect(isAggregateField('thing(')).toBe(false);
    expect(isAggregateField('count()')).toBe(true);
    expect(isAggregateField('unique_count(user)')).toBe(true);
    expect(isAggregateField('unique_count(foo.bar.is-Enterprise_42)')).toBe(true);
  });
});

describe('getExpandedResults()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()'},
      {field: 'last_seen'},
      {field: 'title'},
      {field: 'custom_tag'},
    ],
    sorts: [{field: 'count', kind: 'desc'}],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('preserves aggregated fields', () => {
    let view = new EventView(state);
    let result = getExpandedResults(view, {}, {});

    expect(result.fields).toEqual([
      {field: 'id', width: -1}, // expect count() to be converted to id
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'custom_tag'},
    ]);
    expect(result.query).toEqual('event.type:error');

    // de-duplicate transformed columns
    view = new EventView({
      ...state,
      fields: [
        {field: 'count()'},
        {field: 'last_seen'},
        {field: 'title'},
        {field: 'custom_tag'},
        {field: 'count(id)'},
      ],
    });

    result = getExpandedResults(view, {}, {});

    expect(result.fields).toEqual([
      {field: 'id', width: -1}, // expect count() to be converted to id
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'custom_tag'},
    ]);

    // transform aliased fields, & de-duplicate any transforms
    view = new EventView({
      ...state,
      fields: [
        {field: 'last_seen'}, // expect this to be transformed to transaction.duration
        {field: 'latest_event'},
        {field: 'title'},
        {field: 'avg(transaction.duration)'}, // expect this to be dropped
        {field: 'p75()'},
        {field: 'p95()'},
        {field: 'p99()'},
        // legacy parameterless functions
        {field: 'p75'},
        {field: 'p95'},
        {field: 'p99'},
        {field: 'custom_tag'},
        {field: 'title'}, // not expected to be dropped
        {field: 'unique_count(id)'},
        // expect these aliases to be dropped
        {field: 'apdex'},
        {field: 'impact'},
      ],
    });

    result = getExpandedResults(view, {}, {});

    expect(result.fields).toEqual([
      {field: 'timestamp', width: -1},
      {field: 'id', width: -1},
      {field: 'title'},
      {field: 'transaction.duration', width: -1},
      {field: 'custom_tag'},
      {field: 'title'},
    ]);
  });

  it('applies provided conditions', () => {
    const view = new EventView(state);
    let result = getExpandedResults(view, {extra: 'condition'}, {});
    expect(result.query).toEqual('event.type:error extra:condition');

    // quotes value
    result = getExpandedResults(view, {extra: 'has space'}, {});
    expect(result.query).toEqual('event.type:error extra:"has space"');

    // appends to existing conditions
    result = getExpandedResults(view, {'event.type': 'csp'}, {});
    expect(result.query).toEqual('event.type:csp');
  });

  it('removes any aggregates in either search conditions or extra conditions', () => {
    const view = new EventView({...state, query: 'event.type:error count(id):<10'});
    const result = getExpandedResults(view, {'count(id)': '>2'}, {});
    expect(result.query).toEqual('event.type:error');
  });

  it('applies conditions from dataRow map structure based on fields', () => {
    const view = new EventView(state);
    const result = getExpandedResults(view, {extra: 'condition'}, {title: 'Event title'});
    expect(result.query).toEqual('event.type:error extra:condition title:"Event title"');
  });

  it('applies tag key conditions from event data', () => {
    const view = new EventView(state);
    const event = {
      type: 'error',
      tags: [
        {key: 'nope', value: 'nope'},
        {key: 'custom_tag', value: 'tag_value'},
      ],
    };
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('event.type:error custom_tag:tag_value');
  });

  it('applies project condition to project property', () => {
    const view = new EventView(state);
    let result = getExpandedResults(view, {project: 1});
    expect(result.query).toEqual('event.type:error');
    expect(result.project).toEqual([42, 1]);

    result = getExpandedResults(view, {'project.id': 1});
    expect(result.query).toEqual('event.type:error');
    expect(result.project).toEqual([42, 1]);
  });

  it('applies environment condition to environment property', () => {
    const view = new EventView(state);
    const result = getExpandedResults(view, {environment: 'dev'});
    expect(result.query).toEqual('event.type:error');
    expect(result.environment).toEqual(['staging', 'dev']);
  });

  it('applies tags that overlap globalselection state', () => {
    const view = new EventView({
      ...state,
      fields: [{field: 'project'}, {field: 'environment'}, {field: 'title'}],
    });
    const event = {
      title: 'something bad',
      timestamp: '2020-02-13T17:05:46+00:00',
      tags: [
        {key: 'project', value: '12345'},
        {key: 'environment', value: 'earth'},
      ],
    };
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual(
      'event.type:error tags[project]:12345 tags[environment]:earth title:"something bad"'
    );
    expect(result.project).toEqual([42]);
    expect(result.environment).toEqual(['staging']);
  });

  it('normalizes the timestamp field', () => {
    const view = new EventView({
      ...state,
      fields: [{field: 'timestamp'}],
      sorts: [{field: 'timestamp', kind: 'desc'}],
    });
    const event = {
      type: 'error',
      timestamp: '2020-02-13T17:05:46+00:00',
    };
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('event.type:error timestamp:2020-02-13T17:05:46');
  });

  it('does not duplicate conditions', () => {
    const view = new EventView({
      ...state,
      query: 'event.type:error title:bogus',
    });
    const event = {
      title: 'bogus',
    };
    const result = getExpandedResults(view, {trace: 'abc123'}, event);
    expect(result.query).toEqual('event.type:error title:bogus trace:abc123');
  });
});

describe('getDiscoverLandingUrl', function() {
  it('is correct for with discover-query and discover-basic features', function() {
    const org = TestStubs.Organization({features: ['discover-query', 'discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/queries/');
  });

  it('is correct for with only discover-basic feature', function() {
    const org = TestStubs.Organization({features: ['discover-basic']});
    expect(getDiscoverLandingUrl(org)).toBe('/organizations/org-slug/discover/results/');
  });
});

describe('explodeField', function() {
  it('explodes fields', function() {
    expect(explodeField({field: 'foobar'})).toEqual({
      aggregation: '',
      field: 'foobar',
      width: -1,
    });

    // has width
    expect(explodeField({field: 'foobar', width: 123})).toEqual({
      aggregation: '',
      field: 'foobar',
      width: 123,
    });

    // has aggregation
    expect(explodeField({field: 'count(foobar)', width: 123})).toEqual({
      aggregation: 'count',
      field: 'foobar',
      width: 123,
    });

    // custom tag
    expect(explodeField({field: 'foo.bar.is-Enterprise_42', width: 123})).toEqual({
      aggregation: '',
      field: 'foo.bar.is-Enterprise_42',
      width: 123,
    });

    // custom tag with aggregation
    expect(explodeField({field: 'count(foo.bar.is-Enterprise_42)', width: 123})).toEqual({
      aggregation: 'count',
      field: 'foo.bar.is-Enterprise_42',
      width: 123,
    });
  });
});

describe('hasAggregateField', function() {
  it('ensures an eventview has an aggregate field', function() {
    let eventView = new EventView({
      fields: [{field: 'foobar'}],
      sorts: [],
      query: '',
      project: [],
      environment: [],
    });

    expect(hasAggregateField(eventView)).toBe(false);

    eventView = new EventView({
      fields: [{field: 'count(foo.bar.is-Enterprise_42)'}],
      sorts: [],
      query: '',
      project: [],
      environment: [],
    });

    expect(hasAggregateField(eventView)).toBe(true);
  });
});
