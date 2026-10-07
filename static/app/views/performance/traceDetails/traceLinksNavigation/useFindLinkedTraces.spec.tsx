import {SEARCH_SENTRY__LINK__TYPE} from '@sentry/conventions/attributes/search';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {TraceItemResponseLink} from 'sentry/views/explore/hooks/useTraceItemDetails';

import {useFindAdjacentTrace} from './useFindLinkedTraces';

const LINK_TRACE_ID = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const LINK_SPAN_ID = 'a1b2c3d4e5f60718';
const ATTRIBUTE_TRACE_ID = '0f9e8d7c6b5a49382716051f2e3d4c5b';
const ATTRIBUTE_SPAN_ID = '0f9e8d7c6b5a4938';

describe('useFindAdjacentTrace', () => {
  const organization = OrganizationFixture();

  function makePreviousTraceLink(
    overrides: Partial<TraceItemResponseLink> = {}
  ): TraceItemResponseLink {
    return {
      traceId: LINK_TRACE_ID,
      itemId: LINK_SPAN_ID,
      sampled: true,
      attributes: [
        {name: SEARCH_SENTRY__LINK__TYPE, type: 'str', value: 'previous_trace'},
      ],
      ...overrides,
    };
  }

  function renderPreviousTraceLookup(links?: TraceItemResponseLink[]) {
    return renderHookWithProviders(
      () =>
        useFindAdjacentTrace({
          direction: 'previous',
          attributes: [
            {name: 'project_id', type: 'int', value: 1},
            {
              name: 'previous_trace',
              type: 'str',
              value: `${ATTRIBUTE_TRACE_ID}-${ATTRIBUTE_SPAN_ID}-1`,
            },
          ],
          links,
          adjacentTraceStartTimestamp: 1000,
          adjacentTraceEndTimestamp: 2000,
        }),
      {organization}
    );
  }

  // Responds only to a lookup of this span, so a lookup of another span
  // finds nothing.
  function mockSpanLookup(traceId: string, spanId: string) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [{id: spanId, trace: traceId}]},
      match: [MockApiClient.matchQuery({query: `id:${spanId} trace:${traceId}`})],
    });
  }

  it('finds the previous trace from the link before the attribute', async () => {
    mockSpanLookup(LINK_TRACE_ID, LINK_SPAN_ID);

    const {result} = renderPreviousTraceLookup([makePreviousTraceLink()]);

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current).toEqual({
      trace: LINK_TRACE_ID,
      id: LINK_SPAN_ID,
      available: true,
      isLoading: false,
    });
  });

  it('looks up the previous trace when the link has no sampling decision', async () => {
    mockSpanLookup(LINK_TRACE_ID, LINK_SPAN_ID);

    const {result} = renderPreviousTraceLookup([
      makePreviousTraceLink({sampled: undefined}),
    ]);

    await waitFor(() => expect(result.current.available).toBe(true));
  });

  it('falls back to the attribute when the span has no previous_trace link', async () => {
    mockSpanLookup(ATTRIBUTE_TRACE_ID, ATTRIBUTE_SPAN_ID);

    const {result} = renderPreviousTraceLookup([makePreviousTraceLink({attributes: []})]);

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current).toEqual({
      trace: ATTRIBUTE_TRACE_ID,
      id: ATTRIBUTE_SPAN_ID,
      available: true,
      isLoading: false,
    });
  });
});
