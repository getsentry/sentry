import type {ActiveFilter} from 'sentry/components/events/interfaces/spans/filter';
import {noFilter} from 'sentry/components/events/interfaces/spans/filter';
import type {EnhancedProcessedSpanType} from 'sentry/components/events/interfaces/spans/types';
import WaterfallModel from 'sentry/components/events/interfaces/spans/waterfallModel';
import type {EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';

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
              'http.method': 'GET',
              type: 'fetch',
              url: '/api/0/organizations/?member=1',
            },
          },
          {
            timestamp: 1622079938.20331,
            start_timestamp: 1622079937.907515,
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
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'fonts_bundle.css',
            op: 'fonts',
            span_id: 'a0e89ce4e0900ad5',
            parent_span_id: 'a23f26b939d1a735',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'google-fonts.css',
            op: 'fonts',
            span_id: 'aa764a4e9d70c907',
            parent_span_id: 'a0e89ce4e0900ad5',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'icon-fonts.css',
            op: 'fonts',
            span_id: '883837a47bc0d836',
            parent_span_id: 'a0e89ce4e0900ad5',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: '/_static/dist/sentry/sentry.fonts.min.css',
            op: 'css',
            span_id: 'b5795cf4ba68bbb4',
            parent_span_id: 'a934857184bdf5a6',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'fonts1.css',
            op: 'fonts',
            span_id: 'b5795cf4ba68bbb5',
            parent_span_id: 'b5795cf4ba68bbb4',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'fonts2.css',
            op: 'fonts',
            span_id: 'b5795cf4ba68bbb6',
            parent_span_id: 'b5795cf4ba68bbb5',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'fonts3.css',
            op: 'fonts',
            span_id: 'b5795cf4ba68bbb7',
            parent_span_id: 'b5795cf4ba68bbb6',
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

  const fullWaterfall: EnhancedProcessedSpanType[] = [
    {
      type: 'root_span',
      span: {
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        span_id: 'a934857184bdf5a6',
        start_timestamp: 1622079935.86141,
        timestamp: 1622079940.032905,
        description: undefined,
        parent_span_id: undefined,
        op: 'pageload',
        data: {},
        status: 'unknown',
      },
      numOfSpanChildren: 3,
      treeDepth: 0,
      isLastSibling: true,
      continuingTreeDepths: [],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: expect.anything(),
      fetchEmbeddedChildrenState: 'idle',
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
        tags: {'http.status_code': '200'},
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
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: 1622079937.227645,
        timestamp: 1622079937.907515,
        description: 'Missing span instrumentation',
        isOrphan: false,
      },
      numOfSpanChildren: 0,
      treeDepth: 1,
      isLastSibling: false,
      continuingTreeDepths: [],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
      fetchEmbeddedChildrenState: 'idle',
      isEmbeddedTransactionTimeAdjusted: false,
    },
    {
      type: 'span',
      span: {
        timestamp: 1622079938.20331,
        start_timestamp: 1622079937.907515,
        description: 'GET /api/0/internal/health/',
        op: 'http',
        span_id: 'a453cc713e5baf9c',
        parent_span_id: 'a934857184bdf5a6',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        status: 'ok',
        tags: {'http.status_code': '200'},
        data: {'http.method': 'GET', type: 'fetch', url: '/api/0/internal/health/'},
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
      numOfSpanChildren: 1,
      treeDepth: 2,
      isLastSibling: true,
      continuingTreeDepths: [1],
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
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: 'fonts_bundle.css',
        op: 'fonts',
        span_id: 'a0e89ce4e0900ad5',
        parent_span_id: 'a23f26b939d1a735',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'http.decoded_response_content_length': 159248,
          'http.response_content_length': 159248,
          'http.response_transfer_size': 275,
        },
      },
      numOfSpanChildren: 2,
      treeDepth: 3,
      isLastSibling: true,
      continuingTreeDepths: [1],
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
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: 'google-fonts.css',
        op: 'fonts',
        span_id: 'aa764a4e9d70c907',
        parent_span_id: 'a0e89ce4e0900ad5',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'http.decoded_response_content_length': 159248,
          'http.response_content_length': 159248,
          'http.response_transfer_size': 275,
        },
      },
      numOfSpanChildren: 0,
      treeDepth: 4,
      isLastSibling: false,
      continuingTreeDepths: [1],
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
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: 'icon-fonts.css',
        op: 'fonts',
        span_id: '883837a47bc0d836',
        parent_span_id: 'a0e89ce4e0900ad5',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'http.decoded_response_content_length': 159248,
          'http.response_content_length': 159248,
          'http.response_transfer_size': 275,
        },
      },
      numOfSpanChildren: 0,
      treeDepth: 4,
      isLastSibling: true,
      continuingTreeDepths: [1],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: expect.anything(),
      fetchEmbeddedChildrenState: 'idle',
      toggleNestedSpanGroup: undefined,
      toggleSiblingSpanGroup: undefined,
      isEmbeddedTransactionTimeAdjusted: false,
    },
    {
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: 1622079938.20331,
        timestamp: 1622079938.31431,
        description: 'Missing span instrumentation',
        isOrphan: false,
      },
      numOfSpanChildren: 0,
      treeDepth: 1,
      isLastSibling: false,
      continuingTreeDepths: [],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
      fetchEmbeddedChildrenState: 'idle',
      isEmbeddedTransactionTimeAdjusted: false,
    },
    {
      type: 'span',
      span: {
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: '/_static/dist/sentry/sentry.fonts.min.css',
        op: 'css',
        span_id: 'b5795cf4ba68bbb4',
        parent_span_id: 'a934857184bdf5a6',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'http.decoded_response_content_length': 159248,
          'http.response_content_length': 159248,
          'http.response_transfer_size': 275,
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
      type: 'span_group_chain',
      span: {
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: 'fonts3.css',
        op: 'fonts',
        span_id: 'b5795cf4ba68bbb7',
        parent_span_id: 'b5795cf4ba68bbb6',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'http.decoded_response_content_length': 159248,
          'http.response_content_length': 159248,
          'http.response_transfer_size': 275,
        },
      },
      treeDepth: 2,
      continuingTreeDepths: [],
      spanNestedGrouping: [
        {
          type: 'span',
          span: {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'fonts1.css',
            op: 'fonts',
            span_id: 'b5795cf4ba68bbb5',
            parent_span_id: 'b5795cf4ba68bbb4',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          numOfSpanChildren: 1,
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
        {
          type: 'span',
          span: {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: 'fonts2.css',
            op: 'fonts',
            span_id: 'b5795cf4ba68bbb6',
            parent_span_id: 'b5795cf4ba68bbb5',
            trace_id: '8cbbc19c0f54447ab702f00263262726',
            data: {
              'http.decoded_response_content_length': 159248,
              'http.response_content_length': 159248,
              'http.response_transfer_size': 275,
            },
          },
          numOfSpanChildren: 1,
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
      ],
      isNestedSpanGroupExpanded: false,
      toggleNestedSpanGroup: expect.anything(),
      toggleSiblingSpanGroup: undefined,
    },
    {
      type: 'span',
      span: {
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: 'fonts3.css',
        op: 'fonts',
        span_id: 'b5795cf4ba68bbb7',
        parent_span_id: 'b5795cf4ba68bbb6',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'http.decoded_response_content_length': 159248,
          'http.response_content_length': 159248,
          'http.response_transfer_size': 275,
        },
      },
      numOfSpanChildren: 0,
      treeDepth: 3,
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
      'css',
      'fonts',
      'http',
      'pageload',
      'resource.link',
    ]);

    // toggle http filter
    waterfallModel.toggleOperationNameFilter('http');
    operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual([
      'css',
      'fonts',
      'pageload',
      'resource.link',
    ]);

    // toggle all operation names; expect un-toggled operation names to be toggled on
    waterfallModel.toggleAllOperationNameFilters();
    operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual([
      'css',
      'fonts',
      'http',
      'pageload',
      'resource.link',
    ]);

    // un-toggle all operation names
    waterfallModel.toggleAllOperationNameFilters();
    expect(waterfallModel.operationNameFilters).toEqual(noFilter);
  });

  it('querySpanSearch', async () => {
    const waterfallModel = new WaterfallModel(event);
    expect(waterfallModel.fuse).toBeUndefined();

    // Fuzzy search needs to be loaded asynchronously
    await tick();

    // expect fuse index to be created
    expect(waterfallModel.fuse).toBeDefined();

    expect(waterfallModel.filterSpans).toBeUndefined();
    expect(waterfallModel.searchQuery).toBeUndefined();

    waterfallModel.querySpanSearch('GET /api/0/organizations/?member=1');

    expect(Array.from(waterfallModel.filterSpans!.spanIDs).sort()).toEqual(
      ['a453cc713e5baf9c', 'b23703998ae619e7'].sort()
    );
    expect(waterfallModel.searchQuery).toBe('GET /api/0/organizations/?member=1');
  });

  it('getWaterfall()', async () => {
    const waterfallModel = new WaterfallModel(event);
    // Fuzzy search needs to be loaded asynchronously
    await tick();

    // show all spans in the waterfall
    let spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual(fullWaterfall);

    // perform a window selection
    spans = waterfallModel.getWaterfall({
      viewStart: 0.4,
      viewEnd: 0.65,
    });

    let expected = [...fullWaterfall];

    expected[1] = {
      type: 'out_of_view',
      span: fullWaterfall[1]!.span,
    } as EnhancedProcessedSpanType;

    expected[4] = {
      type: 'out_of_view',
      span: fullWaterfall[4]!.span,
    } as EnhancedProcessedSpanType;

    expect(spans).toEqual(expected);

    // toggle http filter with a window selection
    waterfallModel.toggleOperationNameFilter('http');
    spans = waterfallModel.getWaterfall({
      viewStart: 0.4,
      viewEnd: 0.65,
    });

    assert(
      fullWaterfall[10]!.type === 'span_group_chain' &&
        fullWaterfall[10]!.spanNestedGrouping
    );
    expected = [
      {
        type: 'filtered_out',
        span: fullWaterfall[0]!.span,
      },
      {
        type: 'out_of_view',
        span: fullWaterfall[1]!.span,
      },
      fullWaterfall[2],
      fullWaterfall[3],
      {
        type: 'filtered_out',
        span: fullWaterfall[4]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[5]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[6]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[7]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[9]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[10]!.spanNestedGrouping![0]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[10]!.spanNestedGrouping![1]!.span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[11]!.span,
      },
    ] as EnhancedProcessedSpanType[];

    expect(spans).toEqual(expected);

    // toggle ops filters with a window selection and search query
    // NOTE: http was toggled on in the previous case
    waterfallModel.toggleOperationNameFilter('pageload');
    waterfallModel.querySpanSearch('a453cc713e5baf9c');
    expect(waterfallModel.searchQuery).toBe('a453cc713e5baf9c');
    spans = waterfallModel.getWaterfall({
      viewStart: 0.2,
      viewEnd: 0.65,
    });

    expected[1]!.type = 'filtered_out';

    expect(spans).toEqual(expected);
  });

  it('toggleSpanSubTree()', () => {
    const waterfallModel = new WaterfallModel(event);

    let spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual(fullWaterfall);

    // toggle a span to hide their sub-tree
    waterfallModel.toggleSpanSubTree('a453cc713e5baf9c');

    spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual(
      fullWaterfall.filter((_span, index) => {
        // 5th through 8th spans should be hidden
        return !(index >= 4 && index <= 7);
      })
    );

    // toggle a span to reveal their sub-tree
    waterfallModel.toggleSpanSubTree('a453cc713e5baf9c');

    spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual(fullWaterfall);
  });

  it('span grouping - only child parent-child chain - root is not grouped', () => {
    const event2 = {
      ...event,
      entries: [],
    };

    const waterfallModel = new WaterfallModel(event2);

    const spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual([
      {
        ...fullWaterfall[0],
        numOfSpanChildren: 0,
        toggleNestedSpanGroup: undefined,
      },
    ]);
  });

  it('span grouping - only child parent-child chain - root span and a span (2 spans) are not grouped', () => {
    const event2: EventTransaction = {
      ...event,
      entries: [
        {
          data: [(event.entries[0] as any).data[0]],
          type: EntryType.SPANS,
        },
      ],
    };

    const waterfallModel = new WaterfallModel(event2);

    const spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual([
      {
        ...fullWaterfall[0],
        numOfSpanChildren: 1,
        toggleNestedSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1]!,
        isLastSibling: true,
        numOfSpanChildren: 0,
        toggleNestedSpanGroup: undefined,
      },
    ]);
  });

  it('span grouping - only child parent-child chain - root span and 2 spans (3 spans) are not grouped', () => {
    const event2: EventTransaction = {
      ...event,
      entries: [
        {
          data: [
            (event.entries[0] as any).data[0],
            {
              ...(event.entries[0] as any).data[0],
              parent_span_id: (event.entries[0] as any).data[0].span_id,
              span_id: 'foo',
            },
          ],
          type: EntryType.SPANS,
        },
      ],
    };

    const waterfallModel = new WaterfallModel(event2);

    const spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual([
      {
        ...fullWaterfall[0],
        treeDepth: 0,
        numOfSpanChildren: 1,
        toggleNestedSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1]!,
        treeDepth: 1,
        isLastSibling: true,
        numOfSpanChildren: 1,
        toggleNestedSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1]!,
        span: {
          ...fullWaterfall[1]!.span,
          parent_span_id: (event.entries[0] as any).data[0]!.span_id,
          span_id: 'foo',
        },
        treeDepth: 2,
        isLastSibling: true,
        numOfSpanChildren: 0,
        toggleNestedSpanGroup: undefined,
      },
    ]);
  });

  it('span grouping - only child parent-child chain - root span and 3+ spans (4 spans) are not grouped', () => {
    const event2: EventTransaction = {
      ...event,
      entries: [
        {
          data: [
            (event.entries[0] as any).data[0],
            {
              ...(event.entries[0] as any).data[0],
              parent_span_id: (event.entries[0] as any).data[0]!.span_id,
              span_id: 'foo',
            },
            {
              ...(event.entries[0] as any).data[0],
              parent_span_id: 'foo',
              span_id: 'bar',
            },
          ],
          type: EntryType.SPANS,
        },
      ],
    };
    const waterfallModel = new WaterfallModel(event2);

    let spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    // expect 1 or more spans are grouped
    expect(spans).toHaveLength(3);

    assert(fullWaterfall[1]!.type === 'span');
    const collapsedWaterfallExpected = [
      {
        ...fullWaterfall[0],
        numOfSpanChildren: 1,
        toggleNestedSpanGroup: undefined,
      },
      {
        type: 'span_group_chain',
        treeDepth: 1,
        continuingTreeDepths: fullWaterfall[1]!.continuingTreeDepths,
        span: {
          ...fullWaterfall[1]!.span,
          parent_span_id: 'foo',
          span_id: 'bar',
        },
        spanNestedGrouping: [
          {
            ...fullWaterfall[1]!,
            isLastSibling: true,
            numOfSpanChildren: 1,
            toggleNestedSpanGroup: undefined,
          },
          {
            ...fullWaterfall[1]!,
            span: {
              ...fullWaterfall[1]!.span,
              parent_span_id: (event.entries[0] as any).data[0].span_id,
              span_id: 'foo',
            },
            isLastSibling: true,
            numOfSpanChildren: 1,
            toggleNestedSpanGroup: undefined,
          },
        ],
        isNestedSpanGroupExpanded: false,
        toggleNestedSpanGroup: expect.anything(),
      },
      {
        ...fullWaterfall[1]!,
        span: {
          ...fullWaterfall[1]!.span,
          parent_span_id: 'foo',
          span_id: 'bar',
        },
        isLastSibling: true,
        numOfSpanChildren: 0,
        treeDepth: 2,
        toggleNestedSpanGroup: undefined,
      },
    ];

    expect(spans).toEqual(collapsedWaterfallExpected);

    // Expand span group
    assert(spans[1]!.type === 'span' && spans[1]!.toggleNestedSpanGroup);
    spans[1]!.toggleNestedSpanGroup();

    spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    // expect span group to be expanded
    expect(spans).toHaveLength(4);

    expect(spans).toEqual([
      {
        ...fullWaterfall[0],
        numOfSpanChildren: 1,
        treeDepth: 0,
        toggleNestedSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1]!,
        isLastSibling: true,
        numOfSpanChildren: 1,
        treeDepth: 1,
        toggleNestedSpanGroup: expect.anything(),
      },
      {
        ...fullWaterfall[1]!,
        span: {
          ...fullWaterfall[1]!.span,
          parent_span_id: (event.entries[0] as any).data[0].span_id,
          span_id: 'foo',
        },
        isLastSibling: true,
        numOfSpanChildren: 1,
        treeDepth: 2,
        toggleNestedSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1]!,
        span: {
          ...fullWaterfall[1]!.span,
          parent_span_id: 'foo',
          span_id: 'bar',
        },
        isLastSibling: true,
        numOfSpanChildren: 0,
        treeDepth: 3,
        toggleNestedSpanGroup: undefined,
      },
    ]);

    // Collapse span group
    assert(spans[1]!.type === 'span' && spans[1]!.toggleNestedSpanGroup);
    spans[1]!.toggleNestedSpanGroup();

    spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toHaveLength(3);
    expect(spans).toEqual(collapsedWaterfallExpected);
  });
});
