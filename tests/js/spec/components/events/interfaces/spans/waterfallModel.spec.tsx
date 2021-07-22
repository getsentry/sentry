import {ActiveFilter, noFilter} from 'app/components/events/interfaces/spans/filter';
import {EnhancedProcessedSpanType} from 'app/components/events/interfaces/spans/types';
import WaterfallModel from 'app/components/events/interfaces/spans/waterfallModel';
import {EntryType, EventTransaction} from 'app/types/event';
import {assert} from 'app/types/utils';

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
          {
            timestamp: 1622079938.32451,
            start_timestamp: 1622079938.31431,
            description: '/_static/dist/sentry/sentry.541f5b.min.css',
            op: 'css',
            span_id: 'b5795cf4ba68bbb4',
            parent_span_id: 'a934857184bdf5a6',
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
        tags: {'http.status_code': '200'},
        data: {method: 'GET', type: 'fetch', url: '/api/0/organizations/?member=1'},
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
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: 1622079937.227645,
        timestamp: 1622079937.907515,
        description: 'Missing instrumentation',
        isOrphan: false,
      },
      numOfSpanChildren: 0,
      treeDepth: 1,
      isLastSibling: false,
      continuingTreeDepths: [],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
      fetchEmbeddedChildrenState: 'idle',
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
        data: {method: 'GET', type: 'fetch', url: '/api/0/internal/health/'},
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
      continuingTreeDepths: [1],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: expect.any(Function),
      fetchEmbeddedChildrenState: 'idle',
      spanGrouping: undefined,
      showSpanGroup: false,
      toggleSpanGroup: undefined,
    },
    {
      type: 'gap',
      span: {
        type: 'gap',
        start_timestamp: 1622079938.20331,
        timestamp: 1622079938.31431,
        description: 'Missing instrumentation',
        isOrphan: false,
      },
      numOfSpanChildren: 0,
      treeDepth: 1,
      isLastSibling: false,
      continuingTreeDepths: [],
      showEmbeddedChildren: false,
      toggleEmbeddedChildren: undefined,
      fetchEmbeddedChildrenState: 'idle',
    },
    {
      type: 'span',
      span: {
        timestamp: 1622079938.32451,
        start_timestamp: 1622079938.31431,
        description: '/_static/dist/sentry/sentry.541f5b.min.css',
        op: 'css',
        span_id: 'b5795cf4ba68bbb4',
        parent_span_id: 'a934857184bdf5a6',
        trace_id: '8cbbc19c0f54447ab702f00263262726',
        data: {
          'Decoded Body Size': 159248,
          'Encoded Body Size': 159248,
          'Transfer Size': 275,
        },
      },
      numOfSpanChildren: 0,
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
      'pageload',
      'resource.link',
    ]);

    // toggle all operation names; expect un-toggled operation names to be toggled on
    waterfallModel.toggleAllOperationNameFilters();
    operationNameFilters = waterfallModel.operationNameFilters as ActiveFilter;

    expect(operationNameFilters.type).toBe('active_filter');
    expect(Array.from(operationNameFilters.operationNames)).toEqual([
      'css',
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
    expect(waterfallModel.fuse).toBe(undefined);

    // Fuzzy search needs to be loaded asynchronously
    // @ts-expect-error
    await tick();

    // expect fuse index to be created
    expect(waterfallModel.fuse).not.toBe(undefined);

    expect(waterfallModel.filterSpans).toBe(undefined);
    expect(waterfallModel.searchQuery).toBe(undefined);

    waterfallModel.querySpanSearch('GET /api/0/organizations/?member=1');

    expect(Array.from(waterfallModel.filterSpans!.spanIDs).sort()).toEqual(
      ['a453cc713e5baf9c', 'b23703998ae619e7'].sort()
    );
    expect(waterfallModel.searchQuery).toBe('GET /api/0/organizations/?member=1');
  });

  it('getWaterfall()', async () => {
    const waterfallModel = new WaterfallModel(event);

    // Fuzzy search needs to be loaded asynchronously
    // @ts-expect-error
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

    const expected = [...fullWaterfall];

    expected[1] = {
      type: 'out_of_view',
      span: fullWaterfall[1].span,
    } as EnhancedProcessedSpanType;

    expected[4] = {
      type: 'out_of_view',
      span: fullWaterfall[4].span,
    } as EnhancedProcessedSpanType;

    expect(spans).toEqual(expected);

    // toggle http filter with a window selection
    waterfallModel.toggleOperationNameFilter('http');
    spans = waterfallModel.getWaterfall({
      viewStart: 0.4,
      viewEnd: 0.65,
    });

    expect(spans).toEqual([
      {
        type: 'filtered_out',
        span: fullWaterfall[0].span,
      },
      {
        type: 'out_of_view',
        span: fullWaterfall[1].span,
      },
      fullWaterfall[2],
      fullWaterfall[3],
      {
        type: 'filtered_out',
        span: fullWaterfall[4].span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[6].span,
      },
    ]);

    // toggle ops filters with a window selection and search query
    // NOTE: http was toggled on in the previous case
    waterfallModel.toggleOperationNameFilter('pageload');
    waterfallModel.querySpanSearch('a453cc713e5baf9c');
    expect(waterfallModel.searchQuery).toBe('a453cc713e5baf9c');
    spans = waterfallModel.getWaterfall({
      viewStart: 0.2,
      viewEnd: 0.65,
    });

    expect(spans).toEqual([
      {
        type: 'filtered_out',
        span: fullWaterfall[0].span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[1].span,
      },
      fullWaterfall[2],
      fullWaterfall[3],
      {
        type: 'filtered_out',
        span: fullWaterfall[4].span,
      },
      {
        type: 'filtered_out',
        span: fullWaterfall[6].span,
      },
    ]);
  });

  it('toggleSpanGroup()', () => {
    const waterfallModel = new WaterfallModel(event);

    let spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual(fullWaterfall);

    // toggle a span group to hide their sub-tree
    waterfallModel.toggleSpanGroup('a453cc713e5baf9c');

    spans = waterfallModel.getWaterfall({
      viewStart: 0,
      viewEnd: 1,
    });

    expect(spans).toEqual(
      fullWaterfall.filter((_span, index) => {
        // 5th span should be hidden
        return index !== 4;
      })
    );

    // toggle a span group to reveal their sub-tree
    waterfallModel.toggleSpanGroup('a453cc713e5baf9c');

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
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
    ]);
  });

  it('span grouping - only child parent-child chain - root span and a span (2 spans) are not grouped', () => {
    const event2: EventTransaction = {
      ...event,
      entries: [
        {
          data: [event.entries[0].data[0]],
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
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        isLastSibling: true,
        numOfSpanChildren: 0,
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
    ]);
  });

  it('span grouping - only child parent-child chain - root span and 2 spans (3 spans) are not grouped', () => {
    const event2: EventTransaction = {
      ...event,
      entries: [
        {
          data: [
            event.entries[0].data[0],
            {
              ...event.entries[0].data[0],
              parent_span_id: event.entries[0].data[0].span_id,
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
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        treeDepth: 1,
        isLastSibling: true,
        numOfSpanChildren: 1,
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        span: {
          ...fullWaterfall[1].span,
          parent_span_id: event.entries[0].data[0].span_id,
          span_id: 'foo',
        },
        treeDepth: 2,
        isLastSibling: true,
        numOfSpanChildren: 0,
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
    ]);
  });

  it('span grouping - only child parent-child chain - root span and 3+ spans (4 spans) are not grouped', () => {
    const event2: EventTransaction = {
      ...event,
      entries: [
        {
          data: [
            event.entries[0].data[0],
            {
              ...event.entries[0].data[0],
              parent_span_id: event.entries[0].data[0].span_id,
              span_id: 'foo',
            },
            {
              ...event.entries[0].data[0],
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
    expect(spans).toHaveLength(2);

    expect(spans).toEqual([
      {
        ...fullWaterfall[0],
        numOfSpanChildren: 1,
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        span: {
          ...fullWaterfall[1].span,
          parent_span_id: 'foo',
          span_id: 'bar',
        },
        isLastSibling: true,
        numOfSpanChildren: 0,
        treeDepth: 1,
        spanGrouping: [
          {
            ...fullWaterfall[1],
            isLastSibling: true,
            numOfSpanChildren: 1,
            spanGrouping: undefined,
            showSpanGroup: false,
            toggleSpanGroup: undefined,
          },
          {
            ...fullWaterfall[1],
            span: {
              ...fullWaterfall[1].span,
              parent_span_id: event.entries[0].data[0].span_id,
              span_id: 'foo',
            },
            isLastSibling: true,
            numOfSpanChildren: 1,
            spanGrouping: undefined,
            showSpanGroup: false,
            toggleSpanGroup: undefined,
          },
        ],
        showSpanGroup: false,
        toggleSpanGroup: expect.any(Function),
      },
    ]);

    // Expand span group
    assert(spans[1].type === 'span' && spans[1].toggleSpanGroup);
    spans[1].toggleSpanGroup();

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
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        isLastSibling: true,
        numOfSpanChildren: 1,
        treeDepth: 1,
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        span: {
          ...fullWaterfall[1].span,
          parent_span_id: event.entries[0].data[0].span_id,
          span_id: 'foo',
        },
        isLastSibling: true,
        numOfSpanChildren: 1,
        treeDepth: 2,
        spanGrouping: undefined,
        showSpanGroup: false,
        toggleSpanGroup: undefined,
      },
      {
        ...fullWaterfall[1],
        span: {
          ...fullWaterfall[1].span,
          parent_span_id: 'foo',
          span_id: 'bar',
        },
        isLastSibling: true,
        numOfSpanChildren: 0,
        treeDepth: 3,
        spanGrouping: [
          {
            ...fullWaterfall[1],
            isLastSibling: true,
            numOfSpanChildren: 1,
            spanGrouping: undefined,
            showSpanGroup: false,
            toggleSpanGroup: undefined,
          },
          {
            ...fullWaterfall[1],
            span: {
              ...fullWaterfall[1].span,
              parent_span_id: event.entries[0].data[0].span_id,
              span_id: 'foo',
            },
            treeDepth: 2,
            isLastSibling: true,
            numOfSpanChildren: 1,
            spanGrouping: undefined,
            showSpanGroup: false,
            toggleSpanGroup: undefined,
          },
        ],
        showSpanGroup: true,
        toggleSpanGroup: expect.any(Function),
      },
    ]);
  });
});
