import {Client} from 'app/api';
import SpanTreeModel from 'app/components/events/interfaces/spans/spanTreeModel';
import {EnhancedProcessedSpanType} from 'app/components/events/interfaces/spans/types';
import {
  boundsGenerator,
  generateRootSpan,
  parseTrace,
} from 'app/components/events/interfaces/spans/utils';
import {EntryType, EventTransaction} from 'app/types/event';
import {assert} from 'app/types/utils';

describe('SpanTreeModel', () => {
  const api: Client = new Client();

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

  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/sentry/events/project:19c403a10af34db2b7d93ad669bb51ed/',
    body: {
      ...event,
      contexts: {
        trace: {
          trace_id: '61d2d7c5acf448ffa8e2f8f973e2cd36',
          span_id: 'a5702f287954a9ef',
          parent_span_id: 'b23703998ae619e7',
          op: 'something',
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
              description: 'something child',
              op: 'child',
              span_id: 'bcbea9f18a11e161',
              parent_span_id: 'a5702f287954a9ef',
              trace_id: '61d2d7c5acf448ffa8e2f8f973e2cd36',
              status: 'ok',
              data: {},
            },
          ],
          type: EntryType.SPANS,
        },
      ],
    },
  });

  // @ts-expect-error
  MockApiClient.addMockResponse({
    url: '/organizations/sentry/events/project:broken/',
    body: {
      ...event,
    },
    statusCode: 500,
  });

  it('makes children', () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

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

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);
    expect(spanTreeModel.children).toHaveLength(1);
  });

  it('operationNameCounts', () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

    expect(Object.fromEntries(spanTreeModel.operationNameCounts)).toMatchObject({
      http: 2,
      pageload: 1,
      'resource.link': 1,
    });
  });

  it('toggleEmbeddedChildren - happy path', async () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe('idle');

    const fullWaterfall: EnhancedProcessedSpanType[] = [
      {
        type: 'span',
        span: {
          trace_id: '8cbbc19c0f54447ab702f00263262726',
          span_id: 'a934857184bdf5a6',
          parent_span_id: undefined,
          start_timestamp: 1622079935.86141,
          timestamp: 1622079940.032905,
          op: 'pageload',
          description: undefined,
          data: {},
          status: 'unknown',
        },
        numOfSpanChildren: 2,
        treeDepth: 0,
        isLastSibling: true,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.any(Function),
        fetchEmbeddedChildrenState: 'idle',
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        type: 'span',
        span: {
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
        numOfSpanChildren: 0,
        treeDepth: 1,
        isLastSibling: false,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.any(Function),
        fetchEmbeddedChildrenState: 'idle',
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        type: 'span',
        span: {
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
        numOfSpanChildren: 1,
        treeDepth: 1,
        isLastSibling: true,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.any(Function),
        fetchEmbeddedChildrenState: 'idle',
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        type: 'span',
        span: {
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
        numOfSpanChildren: 0,
        treeDepth: 2,
        isLastSibling: true,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.any(Function),
        fetchEmbeddedChildrenState: 'idle',
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
    ];

    const generateBounds = boundsGenerator({
      traceStartTimestamp: parsedTrace.traceStartTimestamp,
      traceEndTimestamp: parsedTrace.traceEndTimestamp,
      viewStart: 0,
      viewEnd: 1,
    });

    let spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanGroups: new Set(),
      spanGroups: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanGrouping: undefined,
      toggleSpanGroup: undefined,
      showSpanGroup: false,
    });

    expect(spans).toEqual(fullWaterfall);

    const promise = spanTreeModel.toggleEmbeddedChildren({
      orgSlug: 'sentry',
      eventSlug: 'project:19c403a10af34db2b7d93ad669bb51ed',
    });
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe(
      'loading_embedded_transactions'
    );

    await promise;

    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe('idle');

    spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanGroups: new Set(),
      spanGroups: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanGrouping: undefined,
      toggleSpanGroup: undefined,
      showSpanGroup: false,
    });

    const fullWaterfallExpected: EnhancedProcessedSpanType[] = [...fullWaterfall];

    fullWaterfallExpected.splice(
      1,
      0,
      // Expect these spans to be embedded
      {
        type: 'span',
        span: {
          trace_id: '61d2d7c5acf448ffa8e2f8f973e2cd36',
          span_id: 'a5702f287954a9ef',
          parent_span_id: 'b23703998ae619e7',
          start_timestamp: 1622079935.86141,
          timestamp: 1622079940.032905,
          op: 'something',
          description: undefined,
          data: {},
          status: 'unknown',
        },
        numOfSpanChildren: 1,
        treeDepth: 1,
        isLastSibling: false,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.any(Function),
        fetchEmbeddedChildrenState: 'idle',
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        type: 'span',
        span: {
          trace_id: '61d2d7c5acf448ffa8e2f8f973e2cd36',
          span_id: 'bcbea9f18a11e161',
          parent_span_id: 'a5702f287954a9ef',
          start_timestamp: 1622079936.90689,
          timestamp: 1622079937.227645,
          op: 'child',
          description: 'something child',
          data: {},
          status: 'ok',
        },
        numOfSpanChildren: 0,
        treeDepth: 2,
        isLastSibling: true,
        continuingTreeDepths: [1],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.any(Function),
        fetchEmbeddedChildrenState: 'idle',
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      }
    );

    assert(fullWaterfallExpected[0].type === 'span');
    fullWaterfallExpected[0].numOfSpanChildren += 1;
    fullWaterfallExpected[0].showEmbeddedChildren = true;

    expect(spans).toEqual(fullWaterfallExpected);
  });

  it('toggleEmbeddedChildren - error state', async () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

    const promise = spanTreeModel.toggleEmbeddedChildren({
      orgSlug: 'sentry',
      eventSlug: 'project:broken',
    });
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe(
      'loading_embedded_transactions'
    );

    await promise;

    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe(
      'error_fetching_embedded_transactions'
    );
  });
});
