import type {LocationDescriptor} from 'history';

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
    profiler_id: '',
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
      const event = makeTransaction();
      expect(
        makeTraceContinuousProfilingLink(node, event.profiler_id, {
          projectSlug: 'project',
          orgSlug: '',
          traceId: '',
          threadId: '0',
        })
      ).toBeNull();
    });
    it('requires orgSlug', () => {
      const event = makeTransaction();
      expect(
        makeTraceContinuousProfilingLink(node, event.profiler_id, {
          projectSlug: '',
          orgSlug: 'sentry',
          traceId: '',
          threadId: '0',
        })
      ).toBeNull();
    });
    it('requires profilerId', () => {
      expect(
        // @ts-expect-error missing profiler_id
        makeTraceContinuousProfilingLink(node, undefined, {
          projectSlug: 'project',
          orgSlug: 'sentry',
        })
      ).toBeNull();
    });
  });

  it('creates a window of time around end timestamp', () => {
    const timestamp = new Date().getTime();

    const node = new TraceTreeNode(
      null,
      makeTransaction({
        start_timestamp: undefined,
        timestamp: timestamp / 1e3,
        event_id: 'event',
      }),
      {
        project_slug: 'project',
        event_id: 'event',
      }
    );

    const link: LocationDescriptor | null = makeTraceContinuousProfilingLink(
      node,
      'profiler',
      {
        projectSlug: 'project',
        orgSlug: 'sentry',
        traceId: 'trace',
        threadId: '0',
      }
    );

    // @ts-expect-error mismatch in types?
    expect(link.query.start).toBe(new Date(timestamp - 100).toISOString());
    // @ts-expect-error mismatch in types?
    expect(link.query.end).toBe(new Date(timestamp + 100).toISOString());
  });
});
