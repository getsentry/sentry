import {waitFor} from 'sentry-test/reactTestingLibrary';

import SpanTreeModel from 'sentry/components/events/interfaces/spans/spanTreeModel';
import type {
  EnhancedProcessedSpanType,
  RawSpanType,
} from 'sentry/components/events/interfaces/spans/types';
import {
  boundsGenerator,
  generateRootSpan,
  parseTrace,
} from 'sentry/components/events/interfaces/spans/utils';
import type {EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';

describe('SpanTreeModel', () => {
  const api = new MockApiClient();

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
              'http.method': 'GET',
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
              'http.method': 'GET',
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
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
        ],
        type: EntryType.SPANS,
      },
    ],
  } as unknown as EventTransaction;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
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

    MockApiClient.addMockResponse({
      url: '/organizations/sentry/events/project:broken/',
      body: {
        ...event,
      },
      statusCode: 500,
    });
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
                'http.method': 'GET',
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
        toggleEmbeddedChildren: expect.anything(),
        fetchEmbeddedChildrenState: 'idle',
        toggleNestedSpanGroup: undefined,
        toggleSiblingSpanGroup: undefined,
        isEmbeddedTransactionTimeAdjusted: false,
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
            'http.method': 'GET',
            type: 'fetch',
            url: '/api/0/organizations/?member=1',
          },
        },
        numOfSpanChildren: 0,
        treeDepth: 1,
        isLastSibling: false,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.anything(),
        fetchEmbeddedChildrenState: 'idle',
        toggleNestedSpanGroup: undefined,
        toggleSiblingSpanGroup: undefined,
        isEmbeddedTransactionTimeAdjusted: false,
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
            'http.method': 'GET',
            type: 'fetch',
            url: '/api/0/internal/health/',
          },
        },
        numOfSpanChildren: 1,
        treeDepth: 1,
        isLastSibling: true,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.anything(),
        fetchEmbeddedChildrenState: 'idle',
        toggleNestedSpanGroup: undefined,
        toggleSiblingSpanGroup: undefined,
        isEmbeddedTransactionTimeAdjusted: false,
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
            'http.decoded_response_content_length': 159248,
            'http.response_content_length': 159248,
            'http.response_transfer_size': 275,
          },
        },
        numOfSpanChildren: 0,
        treeDepth: 2,
        isLastSibling: true,
        continuingTreeDepths: [],
        showEmbeddedChildren: false,
        toggleEmbeddedChildren: expect.anything(),
        fetchEmbeddedChildrenState: 'idle',
        toggleNestedSpanGroup: undefined,
        toggleSiblingSpanGroup: undefined,
        isEmbeddedTransactionTimeAdjusted: false,
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
      hiddenSpanSubTrees: new Set(),
      spanAncestors: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
      directParent: null,
    });

    expect(spans).toEqual(fullWaterfall);

    let mockAddTraceBounds = jest.fn();
    let mockRemoveTraceBounds = jest.fn();

    // embed a child transaction
    const eventSlug = generateEventSlug({
      id: '19c403a10af34db2b7d93ad669bb51ed',
      project: 'project',
    });

    let promise = spanTreeModel.makeToggleEmbeddedChildren({
      addTraceBounds: mockAddTraceBounds,
      removeTraceBounds: mockRemoveTraceBounds,
    })('sentry', [eventSlug]);
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe(
      'loading_embedded_transactions'
    );

    await promise;

    expect(mockAddTraceBounds).toHaveBeenCalled();
    expect(mockRemoveTraceBounds).not.toHaveBeenCalled();
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe('idle');

    spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanSubTrees: new Set(),
      spanAncestors: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
      directParent: null,
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
        toggleEmbeddedChildren: expect.anything(),
        fetchEmbeddedChildrenState: 'idle',
        toggleNestedSpanGroup: undefined,
        toggleSiblingSpanGroup: undefined,
        isEmbeddedTransactionTimeAdjusted: false,
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
        toggleEmbeddedChildren: expect.anything(),
        fetchEmbeddedChildrenState: 'idle',
        toggleNestedSpanGroup: undefined,
        toggleSiblingSpanGroup: undefined,
        isEmbeddedTransactionTimeAdjusted: false,
      }
    );

    fullWaterfallExpected[0] = {
      ...fullWaterfallExpected[0]!,
    };
    assert(fullWaterfallExpected[0]!.type === 'span');
    fullWaterfallExpected[0]!.numOfSpanChildren += 1;
    fullWaterfallExpected[0]!.showEmbeddedChildren = true;

    expect(spans).toEqual(fullWaterfallExpected);

    mockAddTraceBounds = jest.fn();
    mockRemoveTraceBounds = jest.fn();

    // un-embed a child transaction
    promise = spanTreeModel.makeToggleEmbeddedChildren({
      addTraceBounds: mockAddTraceBounds,
      removeTraceBounds: mockRemoveTraceBounds,
    })('sentry', [eventSlug]);
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe('idle');

    await promise;

    expect(mockAddTraceBounds).not.toHaveBeenCalled();
    expect(mockRemoveTraceBounds).toHaveBeenCalled();
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe('idle');

    spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanSubTrees: new Set(),
      spanAncestors: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
      directParent: null,
    });

    expect(spans).toEqual(fullWaterfall);
  });

  it('toggleEmbeddedChildren - error state', async () => {
    const parsedTrace = parseTrace(event);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);
    const eventSlug = generateEventSlug({
      id: 'broken',
      project: 'project',
    });

    spanTreeModel.makeToggleEmbeddedChildren({
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
    })('sentry', [eventSlug]);
    expect(spanTreeModel.fetchEmbeddedChildrenState).toBe(
      'loading_embedded_transactions'
    );

    await waitFor(() =>
      expect(spanTreeModel.fetchEmbeddedChildrenState).toBe(
        'error_fetching_embedded_transactions'
      )
    );
  });

  it('automatically groups siblings with the same operation and description', () => {
    const event2 = {
      ...event,
      entries: [
        {
          data: [],
          type: EntryType.SPANS,
        },
      ],
    } as EventTransaction;

    const spanTemplate = {
      timestamp: 1622079937.20331,
      start_timestamp: 1622079936.907515,
      description: 'test_description',
      op: 'test',
      span_id: 'a453cc713e5baf9c',
      parent_span_id: 'a934857184bdf5a6',
      trace_id: '8cbbc19c0f54447ab702f00263262726',
      status: 'ok',
      tags: {
        'http.status_code': '200',
      },
      data: {
        'http.method': 'GET',
        type: 'fetch',
        url: '/api/0/internal/health/',
      },
    };

    if (!Array.isArray(event2.entries[0]!.data)) {
      throw new Error('event2.entries[0].data is not an array');
    }

    const data = event2.entries[0]!.data as RawSpanType[];
    for (let i = 0; i < 5; i++) {
      data.push(spanTemplate);
    }

    const parsedTrace = parseTrace(event2);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

    const generateBounds = boundsGenerator({
      traceStartTimestamp: parsedTrace.traceStartTimestamp,
      traceEndTimestamp: parsedTrace.traceEndTimestamp,
      viewStart: 0,
      viewEnd: 1,
    });

    const spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanSubTrees: new Set(),
      spanAncestors: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
      directParent: null,
    });

    expect(spans.length).toEqual(2);
    expect(spans[1]!.type).toEqual('span_group_siblings');

    // If statement here is required to avoid TS linting issues
    if (spans[1]!.type === 'span_group_siblings') {
      expect(spans[1]!.spanSiblingGrouping!.length).toEqual(5);
    }
  });

  it('does not autogroup similar siblings if there are less than 5 in a row', () => {
    const event2 = {
      ...event,
      entries: [
        {
          data: [],
          type: EntryType.SPANS,
        },
      ],
    } as EventTransaction;

    const spanTemplate = {
      timestamp: 1622079937.20331,
      start_timestamp: 1622079936.907515,
      description: 'test_description',
      op: 'test',
      span_id: 'a453cc713e5baf9c',
      parent_span_id: 'a934857184bdf5a6',
      trace_id: '8cbbc19c0f54447ab702f00263262726',
      status: 'ok',
      tags: {
        'http.status_code': '200',
      },
      data: {
        'http.method': 'GET',
        type: 'fetch',
        url: '/api/0/internal/health/',
      },
    };

    if (!Array.isArray(event2.entries[0]!.data)) {
      throw new Error('event2.entries[0].data is not an array');
    }

    const data = event2.entries[0]!.data as RawSpanType[];
    for (let i = 0; i < 4; i++) {
      data.push(spanTemplate);
    }

    const parsedTrace = parseTrace(event2);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

    const generateBounds = boundsGenerator({
      traceStartTimestamp: parsedTrace.traceStartTimestamp,
      traceEndTimestamp: parsedTrace.traceEndTimestamp,
      viewStart: 0,
      viewEnd: 1,
    });

    const spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanSubTrees: new Set(),
      spanAncestors: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
      directParent: null,
    });

    expect(spans.length).toEqual(5);
    spans.forEach(span => expect(span.type).toEqual('span'));
  });

  it('properly autogroups similar siblings and leaves other siblings ungrouped', () => {
    const event2 = {
      ...event,
      entries: [
        {
          data: [],
          type: EntryType.SPANS,
        },
      ],
    } as EventTransaction;

    const groupableSpanTemplate = {
      timestamp: 1622079937.20331,
      start_timestamp: 1622079936.907515,
      description: 'test_description',
      op: 'test',
      span_id: 'a453cc713e5baf9c',
      parent_span_id: 'a934857184bdf5a6',
      trace_id: '8cbbc19c0f54447ab702f00263262726',
      status: 'ok',
      tags: {
        'http.status_code': '200',
      },
      data: {
        'http.method': 'GET',
        type: 'fetch',
        url: '/api/0/internal/health/',
      },
    };

    const normalSpanTemplate = {
      timestamp: 1622079937.20331,
      start_timestamp: 1622079936.907515,
      description: 'dont_group_me',
      op: 'http',
      span_id: 'a453cc713e5baf9c',
      parent_span_id: 'a934857184bdf5a6',
      trace_id: '8cbbc19c0f54447ab702f00263262726',
      status: 'ok',
      tags: {
        'http.status_code': '200',
      },
      data: {
        'http.method': 'GET',
        type: 'fetch',
        url: '/api/0/internal/health/',
      },
    };

    if (!Array.isArray(event2.entries[0]!.data)) {
      throw new Error('event2.entries[0].data is not an array');
    }

    const data = event2.entries[0]!.data as RawSpanType[];
    for (let i = 0; i < 7; i++) {
      data.push(groupableSpanTemplate);
    }

    // This span should not get grouped with the others
    data.push(normalSpanTemplate);

    for (let i = 0; i < 5; i++) {
      data.push(groupableSpanTemplate);
    }

    const parsedTrace = parseTrace(event2);
    const rootSpan = generateRootSpan(parsedTrace);

    const spanTreeModel = new SpanTreeModel(rootSpan, parsedTrace.childSpans, api);

    const generateBounds = boundsGenerator({
      traceStartTimestamp: parsedTrace.traceStartTimestamp,
      traceEndTimestamp: parsedTrace.traceEndTimestamp,
      viewStart: 0,
      viewEnd: 1,
    });

    const spans = spanTreeModel.getSpansList({
      operationNameFilters: {
        type: 'no_filter',
      },
      generateBounds,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      hiddenSpanSubTrees: new Set(),
      spanAncestors: new Set(),
      filterSpans: undefined,
      previousSiblingEndTimestamp: undefined,
      event,
      isOnlySibling: true,
      spanNestedGrouping: undefined,
      toggleNestedSpanGroup: undefined,
      isNestedSpanGroupExpanded: false,
      addTraceBounds: () => {},
      removeTraceBounds: () => {},
      directParent: null,
    });

    expect(spans.length).toEqual(4);
    expect(spans[1]!.type).toEqual('span_group_siblings');
    expect(spans[2]!.type).toEqual('span');
    expect(spans[3]!.type).toEqual('span_group_siblings');
  });
});
