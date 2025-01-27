import type {Location} from 'history';
import {EventFixture} from 'sentry-fixture/event';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {openAddToDashboardModal} from 'sentry/actionCreators/modal';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {EventViewOptions} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import {
  constructAddQueryToDashboardLink,
  decodeColumnOrder,
  downloadAsCsv,
  eventViewToWidgetQuery,
  generateFieldOptions,
  getExpandedResults,
  handleAddQueryToDashboard,
  pushEventViewToLocation,
} from 'sentry/views/discover/utils';

jest.mock('sentry/actionCreators/modal');

const baseView: EventViewOptions = {
  display: undefined,
  start: undefined,
  end: undefined,
  id: '0',
  name: undefined,
  fields: [],
  createdBy: undefined,
  environment: [],
  project: [],
  query: '',
  sorts: [],
  statsPeriod: undefined,
  team: [],
  topEvents: undefined,
};

describe('decodeColumnOrder', function () {
  it('can decode 0 elements', function () {
    const results = decodeColumnOrder([]);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results).toHaveLength(0);
  });

  it('can decode fields', function () {
    const results = decodeColumnOrder([{field: 'title', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'title',
      name: 'title',
      column: {
        kind: 'field',
        field: 'title',
      },
      width: 123,
      isSortable: false,
      type: 'string',
    });
  });

  it('can decode measurement fields', function () {
    const results = decodeColumnOrder([{field: 'measurements.foo', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'measurements.foo',
      name: 'measurements.foo',
      column: {
        kind: 'field',
        field: 'measurements.foo',
      },
      width: 123,
      isSortable: false,
      type: 'number',
    });
  });

  it('can decode span op breakdown fields', function () {
    const results = decodeColumnOrder([{field: 'spans.foo', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'spans.foo',
      name: 'spans.foo',
      column: {
        kind: 'field',
        field: 'spans.foo',
      },
      width: 123,
      isSortable: false,
      type: 'duration',
    });
  });

  it('can decode aggregate functions with no arguments', function () {
    let results = decodeColumnOrder([{field: 'count()', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results[0]).toEqual({
      key: 'count()',
      name: 'count()',
      column: {
        kind: 'function',
        function: ['count', '', undefined, undefined],
      },
      width: 123,
      isSortable: true,
      type: 'number',
    });

    results = decodeColumnOrder([{field: 'p75()', width: 123}]);
    expect(results[0]!.type).toBe('duration');

    results = decodeColumnOrder([{field: 'p99()', width: 123}]);
    expect(results[0]!.type).toBe('duration');
  });

  it('can decode elements with aggregate functions with arguments', function () {
    const results = decodeColumnOrder([{field: 'avg(transaction.duration)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'avg(transaction.duration)',
      name: 'avg(transaction.duration)',
      column: {
        kind: 'function',
        function: ['avg', 'transaction.duration', undefined, undefined],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'duration',
    });
  });

  it('can decode elements with aggregate functions with multiple arguments', function () {
    const results = decodeColumnOrder([
      {field: 'percentile(transaction.duration, 0.65)'},
    ]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'percentile(transaction.duration, 0.65)',
      name: 'percentile(transaction.duration, 0.65)',
      column: {
        kind: 'function',
        function: ['percentile', 'transaction.duration', '0.65', undefined],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'duration',
    });
  });

  it('can decode elements with aggregate functions using measurements', function () {
    const results = decodeColumnOrder([{field: 'avg(measurements.foo)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'avg(measurements.foo)',
      name: 'avg(measurements.foo)',
      column: {
        kind: 'function',
        function: ['avg', 'measurements.foo', undefined, undefined],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'number',
    });
  });

  it('can decode elements with aggregate functions with multiple arguments using measurements', function () {
    const results = decodeColumnOrder([{field: 'percentile(measurements.lcp, 0.65)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'percentile(measurements.lcp, 0.65)',
      name: 'percentile(measurements.lcp, 0.65)',
      column: {
        kind: 'function',
        function: ['percentile', 'measurements.lcp', '0.65', undefined],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'duration',
    });
  });

  it('can decode elements with aggregate functions using span op breakdowns', function () {
    const results = decodeColumnOrder([{field: 'avg(spans.foo)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'avg(spans.foo)',
      name: 'avg(spans.foo)',
      column: {
        kind: 'function',
        function: ['avg', 'spans.foo', undefined, undefined],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'duration',
    });
  });

  it('can decode elements with aggregate functions with multiple arguments using span op breakdowns', function () {
    const results = decodeColumnOrder([{field: 'percentile(spans.lcp, 0.65)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'percentile(spans.lcp, 0.65)',
      name: 'percentile(spans.lcp, 0.65)',
      column: {
        kind: 'function',
        function: ['percentile', 'spans.lcp', '0.65', undefined],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'duration',
    });
  });
});

describe('pushEventViewToLocation', function () {
  const state: EventViewOptions = {
    ...baseView,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()', width: 420}, {field: 'project.id'}],
    sorts: [{field: 'count', kind: 'desc'}],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const location = LocationFixture({
    query: {
      bestCountry: 'canada',
    },
  });

  it('correct query string object pushed to history', function () {
    const navigate = jest.fn();
    const eventView = new EventView({...baseView, ...state});

    pushEventViewToLocation({
      navigate,
      location,
      nextEventView: eventView,
    });

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          id: '1234',
          name: 'best query',
          field: ['count()', 'project.id'],
          widths: '420',
          sort: '-count',
          query: 'event.type:error',
          project: '42',
          start: '2019-10-01T00:00:00',
          end: '2019-10-02T00:00:00',
          statsPeriod: '14d',
          environment: 'staging',
          yAxis: 'count()',
        }),
      })
    );
  });

  it('extra query params', function () {
    const navigate = jest.fn();
    const eventView = new EventView({...baseView, ...state});

    pushEventViewToLocation({
      navigate,
      location,
      nextEventView: eventView,
      extraQuery: {
        cursor: 'some cursor',
      },
    });

    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          id: '1234',
          name: 'best query',
          field: ['count()', 'project.id'],
          widths: '420',
          sort: '-count',
          query: 'event.type:error',
          project: '42',
          start: '2019-10-01T00:00:00',
          end: '2019-10-02T00:00:00',
          statsPeriod: '14d',
          environment: 'staging',
          cursor: 'some cursor',
          yAxis: 'count()',
        }),
      })
    );
  });
});

describe('getExpandedResults()', function () {
  const state: EventViewOptions = {
    ...baseView,
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()'},
      {field: 'last_seen()'},
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

  it('id should be default column when drilldown results in no columns', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [{field: 'count()'}, {field: 'epm()'}, {field: 'eps()'}],
    });

    const result = getExpandedResults(view, {}, EventFixture());

    expect(result.fields).toEqual([{field: 'id', width: -1}]);
  });

  it('preserves aggregated fields', () => {
    let view = new EventView(state);

    let result = getExpandedResults(view, {}, EventFixture());
    // id should be omitted as it is an implicit property on unaggregated results.
    expect(result.fields).toEqual([
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'custom_tag'},
    ]);
    expect(result.query).toBe('event.type:error title:ApiException');

    // de-duplicate transformed columns
    view = new EventView({
      ...baseView,
      ...state,
      fields: [
        {field: 'count()'},
        {field: 'last_seen()'},
        {field: 'title'},
        {field: 'custom_tag'},
        {field: 'count(id)'},
      ],
    });

    result = getExpandedResults(view, {}, EventFixture());
    // id should be omitted as it is an implicit property on unaggregated results.
    expect(result.fields).toEqual([
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'custom_tag'},
    ]);

    // transform aliased fields, & de-duplicate any transforms
    view = new EventView({
      ...baseView,
      ...state,
      fields: [
        {field: 'last_seen()'}, // expect this to be transformed to timestamp
        {field: 'title'},
        {field: 'avg(transaction.duration)'}, // expect this to be dropped
        {field: 'p50()'},
        {field: 'p75()'},
        {field: 'p95()'},
        {field: 'p99()'},
        {field: 'p100()'},
        {field: 'p9001()'}, // it's over 9000
        {field: 'foobar()'}, // unknown function with no parameter
        {field: 'custom_tag'},
        {field: 'transaction.duration'}, // should be dropped
        {field: 'title'}, // should be dropped
        {field: 'unique_count(id)'},
        {field: 'apdex(300)'}, // should be dropped
        {field: 'user_misery(300)'}, // should be dropped
        {field: 'failure_count()'}, // expect this to be transformed to transaction.status
      ],
    });

    result = getExpandedResults(view, {}, EventFixture());
    expect(result.fields).toEqual([
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'transaction.duration', width: -1},
      {field: 'custom_tag'},
      {field: 'transaction.status', width: -1},
    ]);

    // transforms pXX functions with optional arguments properly
    view = new EventView({
      ...baseView,
      ...state,
      fields: [
        {field: 'p50(transaction.duration)'},
        {field: 'p75(measurements.foo)'},
        {field: 'p95(measurements.bar)'},
        {field: 'p99(measurements.fcp)'},
        {field: 'p100(measurements.lcp)'},
      ],
    });

    result = getExpandedResults(view, {}, EventFixture());
    expect(result.fields).toEqual([
      {field: 'transaction.duration', width: -1},
      {field: 'measurements.foo', width: -1},
      {field: 'measurements.bar', width: -1},
      {field: 'measurements.fcp', width: -1},
      {field: 'measurements.lcp', width: -1},
    ]);
  });

  it('applies provided additional conditions', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [...state.fields, {field: 'measurements.lcp'}, {field: 'measurements.fcp'}],
    });
    let result = getExpandedResults(view, {extra: 'condition'}, EventFixture());
    expect(result.query).toBe('event.type:error extra:condition title:ApiException');

    // handles user tag values.
    result = getExpandedResults(view, {user: 'id:12735'}, EventFixture());
    expect(result.query).toBe('event.type:error user:id:12735 title:ApiException');
    result = getExpandedResults(view, {user: 'name:uhoh'}, EventFixture());
    expect(result.query).toBe('event.type:error user:name:uhoh title:ApiException');

    // quotes value
    result = getExpandedResults(view, {extra: 'has space'}, EventFixture());
    expect(result.query).toBe('event.type:error extra:"has space" title:ApiException');

    // appends to existing conditions
    result = getExpandedResults(view, {'event.type': 'csp'}, EventFixture());
    expect(result.query).toBe('event.type:csp title:ApiException');

    // Includes empty strings
    result = getExpandedResults(view, {}, EventFixture({id: '0', custom_tag: ''}));
    expect(result.query).toBe('event.type:error title:ApiException custom_tag:""');

    // Includes 0
    result = getExpandedResults(view, {}, EventFixture({id: '0', custom_tag: 0}));
    expect(result.query).toBe('event.type:error title:ApiException custom_tag:0');

    // Includes null
    result = getExpandedResults(view, {}, EventFixture({id: '0', custom_tag: null}));
    expect(result.query).toBe('event.type:error title:ApiException custom_tag:""');

    // Handles measurements while ignoring null values
    result = getExpandedResults(
      view,
      {},
      // @ts-expect-error The type on this is wrong, the actual type is ReactText which is just string|number
      // however we seem to have tests that test for null values as well, hence the expect error
      {'measurements.lcp': 2, 'measurements.fcp': null}
    );
    expect(result.query).toBe('event.type:error measurements.lcp:2');
  });

  it('removes any aggregates in either search conditions or extra conditions', () => {
    const view = new EventView({...state, query: 'event.type:error count(id):<10'});
    const result = getExpandedResults(view, {'count(id)': '>2'}, EventFixture());
    expect(result.query).toBe('event.type:error title:ApiException');
  });

  it('applies conditions from dataRow map structure based on fields', () => {
    const view = new EventView(state);
    const result = getExpandedResults(
      view,
      {extra: 'condition'},
      EventFixture({title: 'Event title'})
    );
    expect(result.query).toBe('event.type:error extra:condition title:"Event title"');
  });

  it('applies tag key conditions from event data', () => {
    const view = new EventView(state);
    const event = EventFixture({
      type: 'error',
      tags: [
        {key: 'nope', value: 'nope'},
        {key: 'custom_tag', value: 'tag_value'},
      ],
    });
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('event.type:error title:ApiException custom_tag:tag_value');
  });

  it('generate eventview from an empty eventview', () => {
    const view = EventView.fromLocation(LocationFixture());
    const result = getExpandedResults(view, {some_tag: 'value'}, EventFixture());
    expect(result.fields).toEqual([]);
    expect(result.query).toBe('some_tag:value');
  });

  it('removes equations on aggregates', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [
        {field: 'count()'},
        {field: 'equation|count() / 2'},
        {field: 'equation|(count() - count()) + 5'},
      ],
    });
    const result = getExpandedResults(view, {});
    expect(result.fields).toEqual([
      {
        field: 'id',
        width: -1,
      },
    ]);
  });

  it('keeps equations without aggregates', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [{field: 'count()'}, {field: 'equation|transaction.duration / 2'}],
    });
    const result = getExpandedResults(view, {});
    expect(result.fields).toEqual([
      {
        field: 'equation|transaction.duration / 2',
        width: -1,
      },
    ]);
  });

  it('applies array value conditions from event data', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [...state.fields, {field: 'error.type'}],
    });
    const event = EventFixture({
      type: 'error',
      tags: [
        {key: 'nope', value: 'nope'},
        {key: 'custom_tag', value: 'tag_value'},
      ],
      'error.type': ['DeadSystem Exception', 'RuntimeException', 'RuntimeException'],
    });
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe(
      'event.type:error title:ApiException custom_tag:tag_value error.type:"DeadSystem Exception" error.type:RuntimeException error.type:RuntimeException'
    );
  });

  it('applies project condition to project property', () => {
    const view = new EventView(state);

    const result = getExpandedResults(view, {'project.id': '1'});
    expect(result.query.includes('event.type:error')).toBeTruthy();
    expect(result.project).toEqual([42, 1]);
  });

  it('applies environment condition to environment property', () => {
    const view = new EventView(state);
    const result = getExpandedResults(view, {environment: 'dev'});
    expect(result.query).toBe('event.type:error');
    expect(result.environment).toEqual(['staging', 'dev']);
  });

  it('applies tags that overlap PageFilters state', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [{field: 'project'}, {field: 'environment'}, {field: 'title'}],
    });
    const event = EventFixture({
      title: 'something bad',
      timestamp: '2020-02-13T17:05:46+00:00',
      tags: [
        {key: 'project', value: '12345'},
        {key: 'environment', value: 'earth'},
      ],
    });
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe(
      'event.type:error tags[project]:12345 tags[environment]:earth title:"something bad"'
    );
    expect(result.project).toEqual([42]);
    expect(result.environment).toEqual(['staging']);
  });

  it('applies the normalized user tag', function () {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [{field: 'user'}, {field: 'title'}],
    });
    let event = EventFixture({
      title: 'something bad',
      // user context should be ignored.
      user: {
        id: 1234,
        username: 'uhoh',
      },
      tags: [{key: 'user', value: 'id:1234'}],
    });
    let result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('event.type:error user:id:1234 title:"something bad"');

    event = EventFixture({
      title: 'something bad',
      tags: [{key: 'user', value: '1234'}],
    });
    result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('event.type:error user:1234 title:"something bad"');
  });

  it('applies the user field in a table row', function () {
    const view = new EventView({
      ...state,
      fields: [{field: 'user'}, {field: 'title'}],
    });
    const event = EventFixture({
      title: 'something bad',
      user: 'id:1234',
    });
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('event.type:error user:id:1234 title:"something bad"');
  });

  it('normalizes the timestamp field', () => {
    const view = new EventView({
      ...state,
      fields: [{field: 'timestamp'}],
      sorts: [{field: 'timestamp', kind: 'desc'}],
    });
    const event = EventFixture({
      type: 'error',
      timestamp: '2020-02-13T17:05:46+00:00',
    });
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('event.type:error timestamp:2020-02-13T17:05:46');
  });

  it('does not duplicate conditions', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      query: 'event.type:error title:bogus',
    });
    const event = EventFixture({
      title: 'bogus',
    });
    const result = getExpandedResults(view, {trace: 'abc123'}, event);
    expect(result.query).toBe('event.type:error trace:abc123 title:bogus');
  });

  it('applies project as condition if present', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      query: '',
      fields: [{field: 'project'}],
    });
    const event = EventFixture({project: 'whoosh'});
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('project:whoosh');
  });

  it('applies project name as condition if present', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      query: '',
      fields: [{field: 'project.name'}],
    });
    const event = EventFixture({'project.name': 'whoosh'});
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('project.name:whoosh');
  });

  it('should not trim values that need to be quoted', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      query: '',
      fields: [{field: 'title'}],
    });
    // needs to be quoted because of whitespace in middle
    const event = EventFixture({title: 'hello there '});
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toBe('title:"hello there "');
  });

  it('should add environment from the data row', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      environment: [],
      query: '',
      fields: [{field: 'environment'}],
    });
    expect(view.environment).toEqual([]);
    const event = EventFixture({environment: 'staging'});
    const result = getExpandedResults(view, {}, event);
    expect(result.environment).toEqual(['staging']);
  });

  it('should not add duplicate environment', () => {
    const view = new EventView({
      ...baseView,
      ...state,
      query: '',
      fields: [{field: 'environment'}],
    });
    expect(view.environment).toEqual(['staging']);
    const event = EventFixture({environment: 'staging'});
    const result = getExpandedResults(view, {}, event);
    expect(result.environment).toEqual(['staging']);
  });
});

describe('downloadAsCsv', function () {
  const messageColumn = {key: 'message', name: 'message'};
  const environmentColumn = {key: 'environment', name: 'environment'};
  const countColumn = {key: 'count', name: 'count'};
  const userColumn = {key: 'user', name: 'user'};
  const equationColumn = {key: 'equation| count() + count()', name: 'count() + count()'};
  it('handles raw data', function () {
    const result = {
      data: [
        {message: 'test 1', environment: 'prod'},
        {message: 'test 2', environment: 'test'},
      ],
    };
    expect(
      downloadAsCsv(result, [messageColumn, environmentColumn], 'filename.csv')
    ).toContain(encodeURIComponent('message,environment\r\ntest 1,prod\r\ntest 2,test'));
  });
  it('handles aggregations', function () {
    const result = {
      data: [{count: 3}],
    };
    expect(downloadAsCsv(result, [countColumn], 'filename.csv')).toContain(
      encodeURI('count\r\n3')
    );
  });
  it('quotes unsafe strings', function () {
    const result = {
      data: [{message: '=HYPERLINK(http://some-bad-website#)'}],
    };
    expect(downloadAsCsv(result, [messageColumn], 'filename.csv')).toContain(
      encodeURIComponent("message\r\n'=HYPERLINK(http://some-bad-website#)")
    );
  });
  it('handles the user column', function () {
    const result = {
      data: [
        {message: 'test 0', user: 'name:baz'},
        {message: 'test 1', user: 'id:123'},
        {message: 'test 2', user: 'email:test@example.com'},
        {message: 'test 3', user: 'ip:127.0.0.1'},
      ],
    };
    expect(downloadAsCsv(result, [messageColumn, userColumn], 'filename.csv')).toContain(
      encodeURIComponent(
        'message,user\r\ntest 0,name:baz\r\ntest 1,id:123\r\ntest 2,email:test@example.com\r\ntest 3,ip:127.0.0.1'
      )
    );
  });
  it('handles equations', function () {
    const result = {
      data: [{'equation| count() + count()': 3}],
    };
    expect(downloadAsCsv(result, [equationColumn], 'filename.csv')).toContain(
      encodeURIComponent('count() + count()\r\n3')
    );
  });
});

describe('eventViewToWidgetQuery', function () {
  const state: EventViewOptions = {
    ...baseView,
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()', width: 420}, {field: 'project.id'}],
    sorts: [{field: 'count', kind: 'desc'}],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('updates orderby to function format for top N query', function () {
    const view = new EventView({...baseView, ...state});
    const widgetQuery = eventViewToWidgetQuery({
      eventView: view,
      displayType: DisplayType.TOP_N,
      yAxis: ['count()'],
    });
    expect(widgetQuery.orderby).toBe('-count()');
  });

  it('updates orderby to function format for complex function', function () {
    const view = new EventView({
      ...baseView,
      ...state,
      fields: [{field: 'count_unique(device.locale)', width: 420}, {field: 'project.id'}],
      sorts: [{field: 'count_unique_device_locale', kind: 'desc'}],
    });
    const widgetQuery = eventViewToWidgetQuery({
      eventView: view,
      displayType: DisplayType.TABLE,
    });
    expect(widgetQuery.orderby).toBe('-count_unique(device.locale)');
  });

  it('updates orderby to field', function () {
    const view = new EventView({
      ...baseView,
      ...state,
      sorts: [{field: 'project.id', kind: 'desc'}],
    });
    const widgetQuery = eventViewToWidgetQuery({
      eventView: view,
      displayType: DisplayType.TABLE,
    });
    expect(widgetQuery.orderby).toBe('-project.id');
  });
});

describe('generateFieldOptions', function () {
  it('generates custom measurement field options', function () {
    expect(
      generateFieldOptions({
        organization: initializeOrg().organization,
        customMeasurements: [
          {functions: ['p99'], key: 'measurements.custom.measurement'},
        ],
      })['measurement:measurements.custom.measurement']
    ).toEqual({
      label: 'measurements.custom.measurement',
      value: {
        kind: 'custom_measurement',
        meta: {
          dataType: 'number',
          functions: ['p99'],
          name: 'measurements.custom.measurement',
        },
      },
    });
  });

  it('disambiguates tags that are also fields', function () {
    expect(
      generateFieldOptions({
        organization: initializeOrg().organization,
        tagKeys: ['environment'],
        fieldKeys: ['environment'],
        aggregations: {},
      })
    ).toEqual({
      'field:environment': {
        label: 'environment',
        value: {
          kind: 'field',
          meta: {
            dataType: 'string',
            name: 'environment',
          },
        },
      },
      'tag:environment': {
        label: 'environment',
        value: {
          kind: 'tag',
          meta: {
            dataType: 'string',
            name: 'tags[environment]',
          },
        },
      },
    });
  });
});

describe('constructAddQueryToDashboardLink', function () {
  let organization: Organization;
  let location: Location;
  describe('new widget builder', function () {
    beforeEach(() => {
      organization = OrganizationFixture({
        features: ['dashboards-widget-builder-redesign'],
      });
      location = LocationFixture();
    });

    it('should construct a link with the correct params - total period', function () {
      const eventView = new EventView({
        ...baseView,
        display: DisplayModes.DEFAULT,
        name: 'best query',
      });
      const {query} = constructAddQueryToDashboardLink({
        eventView,
        organization,
        location,
        source: DashboardWidgetSource.DISCOVERV2,
        yAxis: ['count()', 'count_unique(user)'],
        widgetType: WidgetType.TRANSACTIONS,
      });
      expect(query).toEqual({
        start: undefined,
        end: undefined,
        description: '',
        limit: undefined,
        query: [''],
        sort: [''],
        legendAlias: [''],
        field: [],
        title: 'best query',
        dataset: WidgetType.TRANSACTIONS,
        displayType: DisplayType.AREA,
        yAxis: ['count()', 'count_unique(user)'],
        source: DashboardWidgetSource.DISCOVERV2,
      });
    });
    it('should construct a link with the correct params - topN', function () {
      // This test assigns a grouping through the fields array in the event view
      const eventView = new EventView({
        ...baseView,
        display: DisplayModes.TOP5,
        name: 'best query',
        fields: [{field: 'transaction', width: 420}, {field: 'project.id'}],
      });
      const {query} = constructAddQueryToDashboardLink({
        eventView,
        organization,
        location,
        source: DashboardWidgetSource.DISCOVERV2,
        yAxis: ['count()'],
        widgetType: WidgetType.TRANSACTIONS,
      });
      expect(query).toEqual({
        start: undefined,
        end: undefined,
        description: '',
        query: [''],
        sort: [''],
        legendAlias: [''],
        field: ['transaction', 'project.id'],
        title: 'best query',
        dataset: WidgetType.TRANSACTIONS,
        displayType: DisplayType.AREA,
        yAxis: ['count()'],
        limit: 5,
        source: DashboardWidgetSource.DISCOVERV2,
      });
    });
    it('should construct a link with the correct params - daily top N', function () {
      // This test assigns a grouping through the fields array in the event view
      const eventView = new EventView({
        ...baseView,
        display: DisplayModes.DAILYTOP5,
        name: 'best query',
        fields: [{field: 'transaction', width: 420}, {field: 'project.id'}],
      });
      const {query} = constructAddQueryToDashboardLink({
        eventView,
        organization,
        location,
        source: DashboardWidgetSource.DISCOVERV2,
        yAxis: ['count()'],
        widgetType: WidgetType.TRANSACTIONS,
      });
      expect(query).toEqual({
        start: undefined,
        end: undefined,
        description: '',
        query: [''],
        sort: [''],
        legendAlias: [''],
        field: ['transaction', 'project.id'],
        title: 'best query',
        dataset: WidgetType.TRANSACTIONS,
        displayType: DisplayType.BAR,
        yAxis: ['count()'],
        limit: 5,
        source: DashboardWidgetSource.DISCOVERV2,
      });
    });
  });
});

describe('handleAddQueryToDashboard', function () {
  let organization: Organization;
  let location: Location;
  let router: InjectedRouter;
  let mockedOpenAddToDashboardModal: jest.Mock;
  beforeEach(() => {
    organization = OrganizationFixture({});
    location = LocationFixture();
    router = RouterFixture();
    mockedOpenAddToDashboardModal = jest.mocked(openAddToDashboardModal);
  });

  it('constructs the correct widget queries for the modal with single yAxis', function () {
    const eventView = new EventView({
      ...baseView,
      display: DisplayModes.DEFAULT,
      name: 'best query',
    });
    handleAddQueryToDashboard({
      eventView,
      organization,
      location,
      router,
      widgetType: WidgetType.TRANSACTIONS,
      yAxis: ['count()'],
      source: DashboardWidgetSource.DISCOVERV2,
    });
    expect(mockedOpenAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: {
          title: 'best query',
          displayType: DisplayType.AREA,
          queries: [
            {
              name: '',
              fields: ['count()'],
              aggregates: ['count()'],
              columns: [],
              orderby: '',
              conditions: '',
            },
          ],
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.TRANSACTIONS,
        },
      })
    );
  });

  it('constructs the correct widget queries for the modal with single yAxis top N', function () {
    const eventView = new EventView({
      ...baseView,
      display: DisplayModes.TOP5,
      name: 'best query',
      fields: [{field: 'transaction'}],
    });
    handleAddQueryToDashboard({
      eventView,
      organization,
      location,
      router,
      source: DashboardWidgetSource.DISCOVERV2,
      widgetType: WidgetType.TRANSACTIONS,
      yAxis: ['count()'],
    });
    expect(mockedOpenAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: {
          title: 'best query',
          displayType: DisplayType.AREA,
          queries: [
            {
              name: '',
              aggregates: ['count()'],
              columns: ['transaction'],
              fields: ['transaction', 'count()'],
              orderby: '',
              conditions: '',
            },
          ],
          interval: undefined,
          limit: 5,
          widgetType: WidgetType.TRANSACTIONS,
        },
      })
    );
  });

  it('constructs the correct widget queries for the modal with multiple yAxes', function () {
    const eventView = new EventView({
      ...baseView,
      display: DisplayModes.DEFAULT,
      name: 'best query',
    });
    handleAddQueryToDashboard({
      eventView,
      organization,
      location,
      router,
      source: DashboardWidgetSource.DISCOVERV2,
      widgetType: WidgetType.TRANSACTIONS,
      yAxis: ['count()', 'count_unique(user)'],
    });
    expect(mockedOpenAddToDashboardModal).toHaveBeenCalledWith(
      expect.objectContaining({
        widget: {
          title: 'best query',
          displayType: DisplayType.AREA,
          queries: [
            {
              name: '',
              aggregates: ['count()', 'count_unique(user)'],
              columns: [],
              fields: ['count()', 'count_unique(user)'],
              orderby: '',
              conditions: '',
            },
          ],
          interval: undefined,
          limit: undefined,
          widgetType: WidgetType.TRANSACTIONS,
        },
      })
    );
  });

  describe('new widget builder', function () {
    beforeEach(() => {
      organization = OrganizationFixture({
        features: ['dashboards-widget-builder-redesign'],
      });
    });

    it('constructs the correct widget queries for the modal with single yAxis', function () {
      const eventView = new EventView({
        ...baseView,
        display: DisplayModes.DEFAULT,
        name: 'best query',
      });
      handleAddQueryToDashboard({
        eventView,
        organization,
        location,
        router,
        source: DashboardWidgetSource.DISCOVERV2,
        widgetType: WidgetType.TRANSACTIONS,
        yAxis: ['count()'],
      });
      expect(mockedOpenAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            title: 'best query',
            displayType: DisplayType.AREA,
            queries: [
              {
                name: '',
                aggregates: ['count()'],
                columns: [],
                fields: [],
                orderby: '',
                conditions: '',
              },
            ],
            interval: undefined,
            limit: undefined,
            widgetType: WidgetType.TRANSACTIONS,
          },
          widgetAsQueryParams: expect.objectContaining({
            source: DashboardWidgetSource.DISCOVERV2,
          }),
        })
      );
    });

    it('constructs the correct widget queries for the modal with single yAxis top N', function () {
      const eventView = new EventView({
        ...baseView,
        display: DisplayModes.TOP5,
        name: 'best query',
        fields: [{field: 'transaction'}],
      });
      handleAddQueryToDashboard({
        eventView,
        organization,
        location,
        router,
        source: DashboardWidgetSource.DISCOVERV2,
        widgetType: WidgetType.TRANSACTIONS,
        yAxis: ['count()'],
      });
      expect(mockedOpenAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            title: 'best query',
            displayType: DisplayType.AREA,
            queries: [
              {
                name: '',
                aggregates: ['count()'],
                columns: ['transaction'],
                fields: ['transaction'],
                orderby: '',
                conditions: '',
              },
            ],
            interval: undefined,
            limit: 5,
            widgetType: WidgetType.TRANSACTIONS,
          },
          widgetAsQueryParams: expect.objectContaining({
            source: DashboardWidgetSource.DISCOVERV2,
          }),
        })
      );
    });

    it('constructs the correct widget queries for the modal with multiple yAxes', function () {
      const eventView = new EventView({
        ...baseView,
        display: DisplayModes.DEFAULT,
        name: 'best query',
      });
      handleAddQueryToDashboard({
        eventView,
        organization,
        location,
        router,
        source: DashboardWidgetSource.DISCOVERV2,
        widgetType: WidgetType.TRANSACTIONS,
        yAxis: ['count()', 'count_unique(user)'],
      });
      expect(mockedOpenAddToDashboardModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            title: 'best query',
            displayType: DisplayType.AREA,
            queries: [
              {
                name: '',
                aggregates: ['count()', 'count_unique(user)'],
                columns: [],
                fields: [],
                orderby: '',
                conditions: '',
              },
            ],
            interval: undefined,
            limit: undefined,
            widgetType: WidgetType.TRANSACTIONS,
          },
          widgetAsQueryParams: expect.objectContaining({
            source: DashboardWidgetSource.DISCOVERV2,
          }),
        })
      );
    });
  });
});
