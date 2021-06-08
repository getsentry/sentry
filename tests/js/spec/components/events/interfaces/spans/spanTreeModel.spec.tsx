// import {ActiveFilter, noFilter} from 'app/components/events/interfaces/spans/filter';
import SpanTreeModel from 'app/components/events/interfaces/spans/spanTreeModel';
import {generateRootSpan, parseTrace} from 'app/components/events/interfaces/spans/utils';
import {EntryType, EventTransaction} from 'app/types/event';

describe('SpanTreeModel', () => {
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

  it('makes children', () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans);

    expect(spanTreeModel.children).toHaveLength(2);
  });

  it('handles recursive children', () => {
    const event2 = {
      ...event,
      entries: [
        {
          data: [
            {
              timestamp: 1622079937.227645,
              start_timestamp: 1622079936.90689,
              description: 'GET /api/0/organizations/?member=1',
              op: 'http',
              span_id: 'a934857184bdf5a6',
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
          ],
          type: EntryType.SPANS,
        },
      ],
    } as EventTransaction;

    const parsedTrace = parseTrace(event2);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans);
    expect(spanTreeModel.children).toHaveLength(1);
  });

  it('operationNameCounts', () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans);

    expect(Object.fromEntries(spanTreeModel.operationNameCounts)).toMatchObject({
      http: 2,
      pageload: 1,
      'resource.link': 1,
    });
  });
});
