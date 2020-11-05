import {browserHistory} from 'react-router';

import EventView from 'app/utils/discover/eventView';
import {
  decodeColumnOrder,
  pushEventViewToLocation,
  getExpandedResults,
  downloadAsCsv,
} from 'app/views/eventsV2/utils';
import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable';

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

  it('can decode aggregate functions with no arguments', function () {
    let results = decodeColumnOrder([{field: 'count()', width: 123}]);

    expect(Array.isArray(results)).toBeTruthy();
    expect(results[0]).toEqual({
      key: 'count()',
      name: 'count()',
      column: {
        kind: 'function',
        function: ['count', '', undefined],
      },
      width: 123,
      isSortable: true,
      type: 'number',
    });

    results = decodeColumnOrder([{field: 'p75()', width: 123}]);
    expect(results[0].type).toEqual('duration');

    results = decodeColumnOrder([{field: 'p99()', width: 123}]);
    expect(results[0].type).toEqual('duration');
  });

  it('can decode elements with aggregate functions with arguments', function () {
    const results = decodeColumnOrder([{field: 'avg(transaction.duration)'}]);

    expect(Array.isArray(results)).toBeTruthy();

    expect(results[0]).toEqual({
      key: 'avg(transaction.duration)',
      name: 'avg(transaction.duration)',
      column: {
        kind: 'function',
        function: ['avg', 'transaction.duration', undefined],
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
        function: ['percentile', 'transaction.duration', '0.65'],
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
        function: ['avg', 'measurements.foo', undefined],
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
        function: ['percentile', 'measurements.lcp', '0.65'],
      },
      width: COL_WIDTH_UNDEFINED,
      isSortable: true,
      type: 'duration',
    });
  });
});

describe('pushEventViewToLocation', function () {
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

  it('correct query string object pushed to history', function () {
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

  it('extra query params', function () {
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

describe('getExpandedResults()', function () {
  const state = {
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

  it('preserves aggregated fields', () => {
    let view = new EventView(state);

    let result = getExpandedResults(view, {}, {});
    // id should be omitted as it is an implicit property on unaggregated results.
    expect(result.fields).toEqual([
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
        {field: 'last_seen()'},
        {field: 'title'},
        {field: 'custom_tag'},
        {field: 'count(id)'},
      ],
    });

    result = getExpandedResults(view, {}, {});
    // id should be omitted as it is an implicit property on unaggregated results.
    expect(result.fields).toEqual([
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'custom_tag'},
    ]);

    // transform aliased fields, & de-duplicate any transforms
    view = new EventView({
      ...state,
      fields: [
        {field: 'last_seen()'}, // expect this to be transformed to timestamp
        {field: 'latest_event()'},
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
      ],
    });

    result = getExpandedResults(view, {}, {});
    expect(result.fields).toEqual([
      {field: 'timestamp', width: -1},
      {field: 'title'},
      {field: 'transaction.duration', width: -1},
      {field: 'custom_tag'},
    ]);

    // transforms pXX functions with optional arguments properly
    view = new EventView({
      ...state,
      fields: [
        {field: 'p50(transaction.duration)'},
        {field: 'p75(measurements.foo)'},
        {field: 'p95(measurements.bar)'},
        {field: 'p99(measurements.fcp)'},
        {field: 'p100(measurements.lcp)'},
      ],
    });

    result = getExpandedResults(view, {}, {});
    expect(result.fields).toEqual([
      {field: 'transaction.duration', width: -1},
      {field: 'measurements.foo', width: -1},
      {field: 'measurements.bar', width: -1},
      {field: 'measurements.fcp', width: -1},
      {field: 'measurements.lcp', width: -1},
    ]);
  });

  it('applies provided additional conditions', () => {
    const view = new EventView(state);
    let result = getExpandedResults(view, {extra: 'condition'}, {});
    expect(result.query).toEqual('event.type:error extra:condition');

    // handles user tag values.
    result = getExpandedResults(view, {user: 'id:12735'}, {});
    expect(result.query).toEqual('event.type:error user:id:12735');
    result = getExpandedResults(view, {user: 'name:uhoh'}, {});
    expect(result.query).toEqual('event.type:error user:name:uhoh');

    // quotes value
    result = getExpandedResults(view, {extra: 'has space'}, {});
    expect(result.query).toEqual('event.type:error extra:"has space"');

    // appends to existing conditions
    result = getExpandedResults(view, {'event.type': 'csp'}, {});
    expect(result.query).toEqual('event.type:csp');

    // Includes empty strings
    result = getExpandedResults(view, {}, {custom_tag: ''});
    expect(result.query).toEqual('event.type:error custom_tag:""');

    // Includes 0
    result = getExpandedResults(view, {}, {custom_tag: 0});
    expect(result.query).toEqual('event.type:error custom_tag:0');

    // Includes null
    result = getExpandedResults(view, {}, {custom_tag: null});
    expect(result.query).toEqual('event.type:error custom_tag:""');
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

    const result = getExpandedResults(view, {'project.id': 1});
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

  it('applies the normalized user tag', function () {
    const view = new EventView({
      ...state,
      fields: [{field: 'user'}, {field: 'title'}],
    });
    let event = {
      title: 'something bad',
      // user context should be ignored.
      user: {
        id: 1234,
        username: 'uhoh',
      },
      tags: [{key: 'user', value: 'id:1234'}],
    };
    let result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('event.type:error user:id:1234 title:"something bad"');

    event = {
      title: 'something bad',
      tags: [{key: 'user', value: '1234'}],
    };
    result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('event.type:error user:1234 title:"something bad"');
  });

  it('applies the user field in a table row', function () {
    const view = new EventView({
      ...state,
      fields: [{field: 'user'}, {field: 'title'}],
    });
    const event = {
      title: 'something bad',
      user: 'id:1234',
    };
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('event.type:error user:id:1234 title:"something bad"');
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
    expect(result.query).toEqual('event.type:error trace:abc123 title:bogus');
  });

  it('applies project as condition if present', () => {
    const view = new EventView({
      ...state,
      query: '',
      fields: [{field: 'project'}],
    });
    const event = {project: 'whoosh'};
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('project:whoosh');
  });

  it('applies project name as condition if present', () => {
    const view = new EventView({
      ...state,
      query: '',
      fields: [{field: 'project.name'}],
    });
    const event = {'project.name': 'whoosh'};
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('project.name:whoosh');
  });

  it('should not trim values that need to be quoted', () => {
    const view = new EventView({
      ...state,
      query: '',
      fields: [{field: 'title'}],
    });
    // needs to be quoted because of whitespace in middle
    const event = {title: 'hello there '};
    const result = getExpandedResults(view, {}, event);
    expect(result.query).toEqual('title:"hello there "');
  });

  it('should add environment from the data row', () => {
    const view = new EventView({
      ...state,
      environment: [],
      query: '',
      fields: [{field: 'environment'}],
    });
    expect(view.environment).toEqual([]);
    const event = {environment: 'staging'};
    const result = getExpandedResults(view, {}, event);
    expect(result.environment).toEqual(['staging']);
  });

  it('should not add duplicate environment', () => {
    const view = new EventView({
      ...state,
      query: '',
      fields: [{field: 'environment'}],
    });
    expect(view.environment).toEqual(['staging']);
    const event = {environment: 'staging'};
    const result = getExpandedResults(view, {}, event);
    expect(result.environment).toEqual(['staging']);
  });
});

describe('downloadAsCsv', function () {
  const messageColumn = {name: 'message'};
  const environmentColumn = {name: 'environment'};
  const countColumn = {name: 'count'};
  const userColumn = {name: 'user'};
  it('handles raw data', function () {
    const result = {
      data: [
        {message: 'test 1', environment: 'prod'},
        {message: 'test 2', environment: 'test'},
      ],
    };
    expect(downloadAsCsv(result, [messageColumn, environmentColumn])).toContain(
      encodeURIComponent('message,environment\r\ntest 1,prod\r\ntest 2,test')
    );
  });
  it('handles aggregations', function () {
    const result = {
      data: [{count: 3}],
    };
    expect(downloadAsCsv(result, [countColumn])).toContain(encodeURI('count\r\n3'));
  });
  it('quotes unsafe strings', function () {
    const result = {
      data: [{message: '=HYPERLINK(http://some-bad-website#)'}],
    };
    expect(downloadAsCsv(result, [messageColumn])).toContain(
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
    expect(downloadAsCsv(result, [messageColumn, userColumn])).toContain(
      encodeURIComponent(
        'message,user\r\ntest 0,name:baz\r\ntest 1,id:123\r\ntest 2,email:test@example.com\r\ntest 3,ip:127.0.0.1'
      )
    );
  });
});
