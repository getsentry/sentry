import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import type {
  EAPTraceMeta,
  TraceMeta,
} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';

import {useTraceContextSections} from './useTraceContextSections';

function makeTree(overrides: Partial<TraceTree> = {}): TraceTree {
  return {
    type: 'empty',
    root: {
      findChild: () => null,
    },
    vitals: new Map(),
    profiled_events: new Set(),
    ...overrides,
  } as TraceTree;
}

function makeEapMeta(overrides: Partial<EAPTraceMeta> = {}): EAPTraceMeta {
  return {
    errorsCount: 0,
    logsCount: 0,
    metricsCount: 0,
    performanceIssuesCount: 0,
    spansCount: 0,
    spansCountMap: {},
    transactionChildCountMap: {},
    uptimeCount: 0,
    ...overrides,
  };
}

describe('useTraceContextSections', () => {
  it('uses trace meta counts to show tabs before tab data has loaded', () => {
    const {result} = renderHook(() =>
      useTraceContextSections({
        tree: makeTree(),
        logs: undefined,
        metrics: undefined,
        meta: makeEapMeta({
          logsCount: 2,
          metricsCount: 3,
          spansCount: 4,
          spansCountMap: {'gen_ai.chat': 1},
        }),
      })
    );

    expect(result.current.hasLogs).toBe(true);
    expect(result.current.hasMetrics).toBe(true);
    expect(result.current.hasAiSpans).toBe(true);
    expect(result.current.hasTraceEvents).toBe(true);
  });

  it('treats zero trace meta counts as authoritative for logs and metrics', () => {
    const {result} = renderHook(() =>
      useTraceContextSections({
        tree: makeTree({
          root: {
            findChild: () => ({}) as BaseNode,
          } as unknown as TraceTree['root'],
        }),
        logs: [{}] as unknown as OurLogsResponseItem[],
        metrics: {count: 1},
        meta: makeEapMeta(),
      })
    );

    expect(result.current.hasLogs).toBe(false);
    expect(result.current.hasMetrics).toBe(false);
    expect(result.current.hasAiSpans).toBe(true);
  });

  it('uses loaded logs when trace metadata is unavailable', () => {
    const {result} = renderHook(() =>
      useTraceContextSections({
        tree: makeTree(),
        logs: [{}] as unknown as OurLogsResponseItem[],
        metrics: undefined,
        meta: undefined,
      })
    );

    expect(result.current.hasLogs).toBe(true);
    expect(result.current.hasTraceEvents).toBe(false);
  });

  it('falls back to tree data for AI spans when EAP trace meta has no gen_ai span op count', () => {
    const {result} = renderHook(() =>
      useTraceContextSections({
        tree: makeTree({
          root: {
            findChild: () => ({}) as BaseNode,
          } as unknown as TraceTree['root'],
        }),
        logs: undefined,
        metrics: undefined,
        meta: makeEapMeta({spansCountMap: {http: 1}}),
      })
    );

    expect(result.current.hasAiSpans).toBe(true);
  });

  it('does not show logs or metrics from trace meta when the product features are disabled', () => {
    const {result} = renderHook(() =>
      useTraceContextSections({
        tree: makeTree(),
        logs: [{}] as unknown as OurLogsResponseItem[],
        metrics: {count: 1},
        meta: makeEapMeta({
          logsCount: 2,
          metricsCount: 3,
        }),
        logsEnabled: false,
        metricsEnabled: false,
      })
    );

    expect(result.current.hasLogs).toBe(false);
    expect(result.current.hasMetrics).toBe(false);
  });

  it('falls back to loaded data for sections not covered by legacy trace meta', () => {
    const legacyMeta: TraceMeta = {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      span_count: 1,
      span_count_map: {},
      transaction_child_count_map: {},
      transactions: 0,
    };

    const {result} = renderHook(() =>
      useTraceContextSections({
        tree: makeTree({
          root: {
            findChild: () => ({}) as BaseNode,
          } as unknown as TraceTree['root'],
        }),
        logs: [{}] as unknown as OurLogsResponseItem[],
        metrics: {count: 1},
        meta: legacyMeta,
      })
    );

    expect(result.current.hasLogs).toBe(true);
    expect(result.current.hasMetrics).toBe(true);
    expect(result.current.hasAiSpans).toBe(true);
    expect(result.current.hasTraceEvents).toBe(true);
  });
});
