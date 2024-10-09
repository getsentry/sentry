import {
  makeSpan,
  makeTraceError,
  makeTracePerformanceIssue,
  makeTransaction,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import type {TraceTree} from '../traceModels/traceTree';

import {TraceTreeNode} from './traceTreeNode';

const metadata: TraceTree.Metadata = {
  event_id: '1',
  project_slug: 'node',
};

describe('TraceTreeNode', () => {
  it('infers space from timestamp and start_timestamp', () => {
    const node = new TraceTreeNode(null, makeTraceError({timestamp: 1}), metadata);
    expect(node.space).toEqual([1 * 1e3, 0]);
  });

  it('infers start_timestamp and timestamp when not provided', () => {
    const node = new TraceTreeNode(
      null,
      makeSpan({start_timestamp: 1, timestamp: 3}),
      metadata
    );
    expect(node.space).toEqual([1 * 1e3, 2 * 1e3]);
  });

  it('stores performance issue on node', () => {
    const issue = makeTracePerformanceIssue({issue_short_id: 'issue1'});
    const node = new TraceTreeNode(
      null,
      makeTransaction({
        start_timestamp: 1,
        timestamp: 3,
        performance_issues: [issue],
      }),
      metadata
    );
    expect(node.performance_issues.has(issue)).toBe(true);
  });

  it('stores error on node', () => {
    const issue = makeTraceError();

    const node = new TraceTreeNode(
      null,
      makeTransaction({
        start_timestamp: 1,
        timestamp: 3,
        errors: [issue],
      }),
      metadata
    );

    expect(node.errors.has(issue)).toBe(true);
  });

  it('a trace error is stored on node', () => {
    const node = new TraceTreeNode(null, makeTraceError(), metadata);
    expect(node.errors.size).toBe(1);
  });

  it('stores profile on node', () => {
    const node = new TraceTreeNode(
      null,
      makeTransaction({
        start_timestamp: 1,
        timestamp: 3,
        profile_id: 'profile',
      }),
      metadata
    );

    const profile = node.profiles[0] as {profile_id: string};
    expect(profile.profile_id).toBe('profile');
  });

  it('stores profiler_id on node', () => {
    const node = new TraceTreeNode(
      null,
      makeTransaction({
        start_timestamp: 1,
        timestamp: 3,
        profiler_id: 'profile',
      }),
      metadata
    );

    const profile = node.profiles[0] as {profiler_id: string};
    expect(profile.profiler_id).toBe('profile');
  });

  it('stores parent reference', () => {
    const parent = new TraceTreeNode(null, makeTransaction(), metadata);
    const child = new TraceTreeNode(parent, makeTransaction(), metadata);

    expect(child.parent).toBe(parent);
  });

  describe('maxSeverity', () => {
    it('fatal > info', () => {
      const node = new TraceTreeNode(
        null,
        makeTransaction({
          errors: [makeTraceError({level: 'fatal'})],
          performance_issues: [makeTracePerformanceIssue({level: 'info'})],
        }),
        metadata
      );
      expect(node.maxIssueSeverity).toBe('fatal');
    });
  });

  describe('expanding and collapsing', () => {
    it('default is expanded', () => {
      const node = new TraceTreeNode(null, makeTransaction(), metadata);
      expect(node.expanded).toBe(true);
    });

    it('android tcp connections are not expanded by default', () => {
      const node = new TraceTreeNode(
        null,
        makeSpan({op: 'http.client', origin: 'auto.http.okhttp'}),
        metadata
      );

      expect(node.expanded).toBe(false);
    });
  });
});
