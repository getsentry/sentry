import {ActiveFilter, noFilter} from 'app/components/events/interfaces/spans/filter';
import WaterfallModel from 'app/components/events/interfaces/spans/waterfallModel';
import {EntryType, EventTransaction} from 'app/types/event';

describe('WaterfallModel', () => {
  const event = {
    id: '2b658a829a21496b87fd1f14a61abf65',
    eventID: '2b658a829a21496b87fd1f14a61abf65',
    title: '/organizations/:orgId/discover/results/',
    type: 'transaction',
    startTimestamp: 1622079935.86141,
    endTimestamp: 1622079940.032905,
    contexts: {
      trace: {
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        span_id: 'a934857184bdf5a6',
        op: 'pageload',
        status: 'unknown',
        type: 'trace',
      },
    },
    entries: [
      {
        data: [
          {
            timestamp: 1622079937.227645,
            start_timestamp: 1622079936.90689,
            description: 'GET /api/0/organizations/?member=1',
            op: 'http',
            span_id: 'b23703998ae619e7',
            parent_span_id: 'a934857184bdf5a6',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            status: 'ok',
            tags: {
              'http.status_code': '200',
            },
            data: {
              method: 'GET',
              type: 'fetch',
              url: '/api/0/organizations/?member=1',
            },
          },
          {
            timestamp: 1622079937.20331,
            start_timestamp: 1622079936.907515,
            description: 'GET /api/0/internal/health/',
            op: 'http',
            span_id: 'a453cc713e5baf9c',
            parent_span_id: 'a934857184bdf5a6',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            status: 'ok',
            tags: {
              'http.status_code': '200',
            },
            data: {
              method: 'GET',
              type: 'fetch',
              url: '/api/0/internal/health/',
            },
          },
          {
            timestamp: 1622079936.05839,
            start_timestamp: 1622079936.048125,
            description: '/_static/dist/sentry/sentry.541f5b.css',
            op: 'resource.link',
            span_id: 'a23f26b939d1a735',
            parent_span_id: 'a453cc713e5baf9c',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'Decoded Body Size': 159248,
              'Encoded Body Size': 159248,
              'Transfer Size': 275,
            },
          },
        ],
        type: EntryType.SPANS,
      },
    ],
  } as EventTransaction;

  it('isEvent', () => {
    const waterfallModel = new WaterfallModel(event);

    expect(waterfallModel.event).toMatchObject(event);
    expect(waterfallModel.isEvent(event)).toBe(true);
    expect(
      waterfallModel.isEvent({
        ...event,
        id: 'somethingelse',
      })
    ).toBe(false);
  });

  it('get operationNameCounts', () => {
    const waterfallModel = new WaterfallModel(event);

    expect(Object.fromEntries(waterfallModel.operationNameCounts)).toMatchObject({
      http: 2,
      pageload: 1,
      'resource.link': 1,
    });
  });

  it('toggleOperationNameFilter', () => {
    const waterfallModel = new WaterfallModel(event);

    expect(waterfallModel.operationNameFilters).toEqual(noFilter);

    // toggle http filter
    waterfallModel.toggleOperationNameFilter('http');

    const operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual(['http']);

    // un-toggle http filter
    waterfallModel.toggleOperationNameFilter('http');
    expect(waterfallModel.operationNameFilters).toEqual(noFilter);
  });

  it('toggleAllOperationNameFilters', () => {
    const waterfallModel = new WaterfallModel(event);

    expect(waterfallModel.operationNameFilters).toEqual(noFilter);

    // toggle all operation names
    waterfallModel.toggleAllOperationNameFilters();
    let operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual([
      'http',
      'pageload',
      'resource.link',
    ]);

    // toggle http filter
    waterfallModel.toggleOperationNameFilter('http');
    operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual([
      'pageload',
      'resource.link',
    ]);

    // toggle all operation names; expect un-toggled operation names to be toggled on
    waterfallModel.toggleAllOperationNameFilters();
    operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual([
      'http',
      'pageload',
      'resource.link',
    ]);

    // un-toggle all operation names
    waterfallModel.toggleAllOperationNameFilters();
    expect(waterfallModel.operationNameFilters).toEqual(noFilter);
  });
});
