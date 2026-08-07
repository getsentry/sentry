import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {
  TracePinnedAttributeColumn,
  TracePinnedAttributeHeader,
  useTracePinnedAttribute,
  useTracePinnedAttributeData,
} from 'sentry/views/performance/newTraceDetails/tracePinnedAttribute';
import type {VirtualizedViewManager} from 'sentry/views/performance/newTraceDetails/traceRenderers/virtualizedViewManager';

// The column only calls registerPinnedColumnRef, so a minimal stub suffices.
const manager = {
  registerPinnedColumnRef: () => {},
} as unknown as VirtualizedViewManager;

const eventsUrl = '/organizations/org-slug/events/';

function mockPinnedAttributeBatch({
  data = [],
  spanIds,
  statusCode = 200,
}: {
  spanIds: string[];
  data?: Array<Record<string, unknown>>;
  statusCode?: number;
}) {
  return MockApiClient.addMockResponse({
    url: eventsUrl,
    body: statusCode >= 400 ? {detail: 'Unable to load values'} : {data, meta: {}},
    statusCode,
    match: [
      (_url: string, options: Record<string, any>) =>
        spanIds.every(spanId => String(options.query.query).includes(spanId)),
    ],
  });
}

describe('useTracePinnedAttribute', () => {
  it('reads the pinned attribute from the URL', () => {
    const {result} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {
        location: {pathname: '/trace/', query: {pinnedAttribute: 'span.duration'}},
      },
    });

    expect(result.current.pinnedAttribute).toBe('span.duration');
  });

  it('returns null when nothing is pinned', () => {
    const {result} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {location: {pathname: '/trace/'}},
    });

    expect(result.current.pinnedAttribute).toBeNull();
  });

  it('sets the pinned attribute in the URL, preserving other params', async () => {
    const {result, router} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {location: {pathname: '/trace/', query: {foo: 'bar'}}},
    });

    act(() => result.current.setPinnedAttribute('span.op'));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBe('span.op');
    });
    expect(router.location.query.foo).toBe('bar');
  });

  it('clears the pinned attribute from the URL, preserving other params', async () => {
    const {result, router} = renderHookWithProviders(useTracePinnedAttribute, {
      initialRouterConfig: {
        location: {
          pathname: '/trace/',
          query: {pinnedAttribute: 'span.op', foo: 'bar'},
        },
      },
    });

    act(() => result.current.setPinnedAttribute(null));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBeUndefined();
    });
    expect(router.location.query.foo).toBe('bar');
  });
});

describe('useTracePinnedAttributeData', () => {
  it('loads sequential batches in waterfall order', async () => {
    const spanIds = Array.from({length: 101}, (_, index) =>
      index.toString(16).padStart(16, '0')
    );
    const firstBatch = spanIds.slice(0, 100);
    const secondBatch = spanIds.slice(100);
    const firstBatchRequest = mockPinnedAttributeBatch({
      spanIds: firstBatch,
      data: [{span_id: spanIds[0], 'custom.attribute': 'first'}],
    });
    const secondBatchRequest = mockPinnedAttributeBatch({
      spanIds: secondBatch,
      data: [{span_id: spanIds[100], 'custom.attribute': 'last'}],
    });

    const {result} = renderHookWithProviders(
      () =>
        useTracePinnedAttributeData({
          pinnedAttribute: 'custom.attribute',
          spanIds,
          traceSlug: 'trace-id',
        }),
      {organization: OrganizationFixture()}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(firstBatchRequest).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          dataset: 'spans',
          field: ['span_id', 'custom.attribute'],
          per_page: 100,
          query: `trace:trace-id span_id:[${firstBatch.join(',')}]`,
        }),
      })
    );
    expect(secondBatchRequest).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          query: `trace:trace-id span_id:[${secondBatch.join(',')}]`,
        }),
      })
    );
    expect(firstBatchRequest.mock.invocationCallOrder[0]).toBeLessThan(
      secondBatchRequest.mock.invocationCallOrder[0]!
    );
    expect(result.current.valuesBySpanId).toEqual(
      new Map([
        [spanIds[0], 'first'],
        [spanIds[100], 'last'],
      ])
    );
  });

  it('uses one request for up to 100 spans', async () => {
    const spanIds = ['000000000000000a', '000000000000000b'];
    const request = MockApiClient.addMockResponse({
      url: eventsUrl,
      body: {
        data: [{span_id: spanIds[0], 'custom.attribute': 'first'}],
        meta: {},
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useTracePinnedAttributeData({
          pinnedAttribute: 'custom.attribute',
          spanIds,
          traceSlug: 'trace-id',
        }),
      {organization: OrganizationFixture()}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      eventsUrl,
      expect.objectContaining({
        query: expect.objectContaining({
          query: `trace:trace-id span_id:[${spanIds.join(',')}]`,
        }),
      })
    );
  });

  it('only requests new spans when the loaded tree changes', async () => {
    const firstSpanId = '000000000000000a';
    const insertedSpanId = '000000000000000b';
    const lastSpanId = '000000000000000c';
    const initialRequest = mockPinnedAttributeBatch({
      spanIds: [firstSpanId, lastSpanId],
      data: [
        {span_id: firstSpanId, 'custom.attribute': 'first'},
        {span_id: lastSpanId, 'custom.attribute': 'last'},
      ],
    });
    const insertedSpanRequest = mockPinnedAttributeBatch({
      spanIds: [insertedSpanId],
      data: [{span_id: insertedSpanId, 'custom.attribute': 'inserted'}],
    });

    const {result, rerender} = renderHookWithProviders(
      ({spanIds}: {spanIds: string[]}) =>
        useTracePinnedAttributeData({
          pinnedAttribute: 'custom.attribute',
          spanIds,
          traceSlug: 'trace-id',
        }),
      {
        initialProps: {spanIds: [firstSpanId, lastSpanId]},
        organization: OrganizationFixture(),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({spanIds: [firstSpanId, insertedSpanId, lastSpanId]});
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(initialRequest).toHaveBeenCalledTimes(1);
    expect(insertedSpanRequest).toHaveBeenCalledTimes(1);
    expect(result.current.valuesBySpanId).toEqual(
      new Map([
        [firstSpanId, 'first'],
        [lastSpanId, 'last'],
        [insertedSpanId, 'inserted'],
      ])
    );
  });

  it('preserves loaded values when a later batch fails', async () => {
    const spanIds = Array.from({length: 101}, (_, index) =>
      index.toString(16).padStart(16, '0')
    );
    mockPinnedAttributeBatch({
      spanIds: spanIds.slice(0, 100),
      data: [{span_id: spanIds[0], 'custom.attribute': 'first'}],
    });
    mockPinnedAttributeBatch({
      spanIds: spanIds.slice(100),
      statusCode: 500,
    });

    const {result} = renderHookWithProviders(
      () =>
        useTracePinnedAttributeData({
          pinnedAttribute: 'custom.attribute',
          spanIds,
          traceSlug: 'trace-id',
        }),
      {organization: OrganizationFixture()}
    );

    await waitFor(() => expect(result.current.hasError).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.valuesBySpanId.get(spanIds[0]!)).toBe('first');
  });

  it('reuses cached pages when an attribute is pinned again', async () => {
    const spanId = '000000000000000a';
    const request = mockPinnedAttributeBatch({
      spanIds: [spanId],
      data: [{span_id: spanId, 'custom.attribute': 'first'}],
    });

    const {result, rerender} = renderHookWithProviders(
      ({pinnedAttribute}: {pinnedAttribute: string | null}) =>
        useTracePinnedAttributeData({
          pinnedAttribute,
          spanIds: [spanId],
          traceSlug: 'trace-id',
        }),
      {
        initialProps: {pinnedAttribute: 'custom.attribute' as string | null},
        organization: OrganizationFixture(),
      }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({pinnedAttribute: null});
    rerender({pinnedAttribute: 'custom.attribute'});
    await waitFor(() => expect(result.current.valuesBySpanId.get(spanId)).toBe('first'));

    expect(request).toHaveBeenCalledTimes(1);
  });
});

describe('TracePinnedAttributeColumn', () => {
  it('renders a loaded attribute value', () => {
    render(
      <TracePinnedAttributeColumn value={200} isLoading={false} manager={manager} />
    );

    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders a placeholder when the span has no value for the attribute', () => {
    render(
      <TracePinnedAttributeColumn value={undefined} isLoading={false} manager={manager} />
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a loading marker while the span is unresolved', () => {
    render(<TracePinnedAttributeColumn value={undefined} isLoading manager={manager} />);
    expect(screen.getByText('…')).toBeInTheDocument();
  });
});

describe('TracePinnedAttributeHeader', () => {
  it('renders the prettified attribute name', () => {
    render(<TracePinnedAttributeHeader pinnedAttribute="http.response.status_code" />, {
      initialRouterConfig: {
        location: {
          pathname: '/trace/',
          query: {pinnedAttribute: 'http.response.status_code'},
        },
      },
    });

    expect(
      screen.getByText(prettifyAttributeName('http.response.status_code'))
    ).toBeInTheDocument();
  });

  it('unpins the attribute when the remove button is clicked', async () => {
    const {router} = render(<TracePinnedAttributeHeader pinnedAttribute="span.op" />, {
      initialRouterConfig: {
        location: {pathname: '/trace/', query: {pinnedAttribute: 'span.op'}},
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Remove pinned column'}));

    await waitFor(() => {
      expect(router.location.query.pinnedAttribute).toBeUndefined();
    });
  });

  it('shows a warning when some values fail to load', () => {
    render(<TracePinnedAttributeHeader pinnedAttribute="span.op" hasError />, {
      initialRouterConfig: {
        location: {pathname: '/trace/', query: {pinnedAttribute: 'span.op'}},
      },
    });

    expect(
      screen.getByLabelText('Pinned attribute values are incomplete')
    ).toBeInTheDocument();
  });
});
