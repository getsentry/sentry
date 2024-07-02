import type {LocationDescriptor} from 'history';
import {TransactionEventFixture} from 'sentry-fixture/event';

import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {makeTraceContinuousProfilingLink} from './traceProfilingLink';

function makeTransaction(
  overrides: Partial<TraceTree.Transaction> = {}
): TraceTree.Transaction {
  return {
    children: [],
    sdk_name: '',
    start_timestamp: 0,
    timestamp: 1,
    transaction: 'transaction',
    'transaction.op': '',
    'transaction.status': '',
    performance_issues: [],
    errors: [],
    ...overrides,
  } as TraceTree.Transaction;
}

describe('traceProfilingLink', () => {
  describe('required params', () => {
    const node = new TraceTreeNode(null, makeTransaction(), {
      project_slug: '',
      event_id: '',
    });

    it('requires projectSlug', () => {
      const event = TransactionEventFixture();
      expect(
        makeTraceContinuousProfilingLink(node, event, {
          projectSlug: 'project',
          orgSlug: '',
        })
      ).toBeNull();
    });
    it('requires orgSlug', () => {
      const event = TransactionEventFixture();
      expect(
        makeTraceContinuousProfilingLink(node, event, {
          projectSlug: '',
          orgSlug: 'sentry',
        })
      ).toBeNull();
    });
    it('requires profilerId', () => {
      const event = TransactionEventFixture({
        contexts: {
          profile: {
            profiler_id: undefined,
          },
        },
      });
      expect(
        makeTraceContinuousProfilingLink(node, event, {
          projectSlug: 'project',
          orgSlug: 'sentry',
        })
      ).toBeNull();
    });
  });

  it('creates a window of time around end timestamp', () => {
    const event = TransactionEventFixture({
      contexts: {
        profile: {
          profiler_id: 'profiler',
        },
      },
    });

    const timestamp = new Date().getTime();

    const node = new TraceTreeNode(
      null,
      makeTransaction({start_timestamp: undefined, timestamp: timestamp / 1e3}),
      {
        project_slug: '',
        event_id: '',
      }
    );

    const link: LocationDescriptor | null = makeTraceContinuousProfilingLink(
      node,
      event,
      {
        projectSlug: 'project',
        orgSlug: 'sentry',
      }
    );

    // @ts-expect-error mismatch in types?
    expect(link.query.start).toBe(new Date(timestamp - 100).toISOString());
    // @ts-expect-error mismatch in types?
    expect(link.query.end).toBe(new Date(timestamp + 100).toISOString());
  });
});
