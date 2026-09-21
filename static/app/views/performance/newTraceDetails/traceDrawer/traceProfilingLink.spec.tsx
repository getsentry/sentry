import {OrganizationFixture} from 'sentry-fixture/organization';

import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {makeEAPSpan} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {makeTraceContinuousProfilingLink} from './traceProfilingLink';

const organization = OrganizationFixture({slug: 'sentry'});
const options = {
  organization,
  projectSlug: 'project',
  traceId: 'trace-id',
  threadId: 'thread-id',
};

function makeTransactionNode(
  overrides: Parameters<typeof makeEAPSpan>[0] = {}
): EapSpanNode {
  return new EapSpanNode(
    null,
    makeEAPSpan({
      event_id: 'transaction-id',
      transaction_id: 'transaction-id',
      is_transaction: true,
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
      makeTraceContinuousProfilingLink(makeTransactionNode(), 'profiler-id', {
        ...options,
        projectSlug: '',
      })
    ).toBeNull();
  });

  it('requires a profiler ID', () => {
    expect(
      makeTraceContinuousProfilingLink(makeTransactionNode(), '', options)
    ).toBeNull();
  });

  it('requires a transaction ID', () => {
    expect(
      makeTraceContinuousProfilingLink(
        makeTransactionNode({transaction_id: undefined}),
        'profiler-id',
        options
      )
    ).toBeNull();
  });

  it('creates a time window around a transaction without a duration', () => {
    const timestamp = Date.now();
    const node = makeTransactionNode({
      start_timestamp: timestamp / 1e3,
      end_timestamp: timestamp / 1e3,
    });

    expect(makeTraceContinuousProfilingLink(node, 'profiler-id', options)).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          end: new Date(timestamp + 100).toISOString(),
          eventId: 'transaction-id',
          spanId: 'transaction-id',
          start: new Date(timestamp - 100).toISOString(),
          tid: 'thread-id',
          traceId: 'trace-id',
        }),
      })
    );
  });

  it('uses the parent transaction range and IDs for a child span', () => {
    const transaction = makeTransactionNode();
    const span = new EapSpanNode(transaction, makeEAPSpan({event_id: 'child-span-id'}), {
      organization,
    });

    expect(makeTraceContinuousProfilingLink(span, 'profiler-id', options)).toEqual(
      expect.objectContaining({
        query: expect.objectContaining({
          end: new Date(2000).toISOString(),
          eventId: 'transaction-id',
          spanId: 'child-span-id',
          start: new Date(1000).toISOString(),
        }),
      })
    );
  });
});
