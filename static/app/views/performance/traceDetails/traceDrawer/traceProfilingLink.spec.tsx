import {OrganizationFixture} from 'sentry-fixture/organization';

import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import {makeTraceContinuousProfilingLink} from './traceProfilingLink';

const organization = OrganizationFixture({slug: 'sentry'});
const options = {
  organization,
  projectSlug: 'project',
  traceId: 'trace-id',
  threadId: 'thread-id',
};

function makeEapSpanNode(overrides: Parameters<typeof makeEAPSpan>[0] = {}): EapSpanNode {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      event_id: 'span-id',
      start_timestamp: 1,
      end_timestamp: 2,
      ...overrides,
    }),
    {organization}
  );
}

describe('traceProfilingLink', () => {
  it('requires a project slug', () => {
    expect(
      makeTraceContinuousProfilingLink(makeEapSpanNode(), 'profiler-id', {
        ...options,
        projectSlug: '',
      })
    ).toBeNull();
  });

  it('requires a profiler ID', () => {
    expect(makeTraceContinuousProfilingLink(makeEapSpanNode(), '', options)).toBeNull();
  });

  it('constructs a profile link', () => {
    expect(
      makeTraceContinuousProfilingLink(
        makeEapSpanNode({transaction_id: undefined}),
        'profiler-id',
        options
      )
    ).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          end: new Date(2100).toISOString(),
          spanId: 'span-id',
          start: new Date(900).toISOString(),
          tid: 'thread-id',
          traceId: 'trace-id',
        }),
      })
    );
  });

  it('creates a time window around a span without a duration', () => {
    const timestamp = Date.now();
    const node = makeEapSpanNode({
      start_timestamp: timestamp / 1e3,
      end_timestamp: timestamp / 1e3,
    });

    expect(makeTraceContinuousProfilingLink(node, 'profiler-id', options)).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          end: new Date(timestamp + 100).toISOString(),
          spanId: 'span-id',
          start: new Date(timestamp - 100).toISOString(),
          tid: 'thread-id',
          traceId: 'trace-id',
        }),
      })
    );
  });

  it('uses the selected child span range and ID', () => {
    const parent = makeEapSpanNode({
      event_id: 'parent-span-id',
      transaction_id: 'transaction-id',
      start_timestamp: 1,
      end_timestamp: 2,
      is_transaction: true,
    });
    const span = new EapSpanNode(
      parent,
      makeEAPSpan({
        event_id: 'child-span-id',
        start_timestamp: 1.25,
        end_timestamp: 1.5,
      }),
      {organization}
    );

    expect(makeTraceContinuousProfilingLink(span, 'profiler-id', options)).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          end: new Date(1600).toISOString(),
          spanId: 'child-span-id',
          start: new Date(1150).toISOString(),
          transactionId: 'transaction-id',
        }),
      })
    );
  });
});
