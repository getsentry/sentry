import type {EAPTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import {
  getInitialTab,
  TraceLayoutTabKeys,
} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

const sections = {
  hasAiSpans: false,
  hasLogs: false,
  hasMetrics: false,
  hasProfiles: false,
  hasTraceEvents: true,
  hasVitals: false,
};

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

describe('getInitialTab', () => {
  it.each([
    [TraceLayoutTabKeys.LOGS, TraceLayoutTabKeys.LOGS],
    [TraceLayoutTabKeys.METRICS, TraceLayoutTabKeys.METRICS],
    [TraceLayoutTabKeys.AI_SPANS, TraceLayoutTabKeys.AI_SPANS],
  ])(
    'keeps %s selected from the URL while tab data is loading',
    (tabSlugFromUrl, expectedTab) => {
      expect(
        getInitialTab({
          isLoading: true,
          sections,
          tabOptions: [],
          tabSlugFromUrl,
        }).slug
      ).toBe(expectedTab);
    }
  );

  it('falls back to waterfall after loading when the URL tab is unavailable', () => {
    expect(
      getInitialTab({
        isLoading: false,
        sections,
        tabOptions: [],
        tabSlugFromUrl: TraceLayoutTabKeys.LOGS,
      }).slug
    ).toBe(TraceLayoutTabKeys.WATERFALL);
  });

  it.each([
    [TraceLayoutTabKeys.LOGS, {logsEnabled: false}],
    [TraceLayoutTabKeys.METRICS, {metricsEnabled: false}],
  ])(
    'does not preserve %s while loading when the product feature is disabled',
    (tabSlugFromUrl, featureOptions) => {
      expect(
        getInitialTab({
          isLoading: true,
          sections,
          tabOptions: [],
          tabSlugFromUrl,
          ...featureOptions,
        }).slug
      ).toBe(TraceLayoutTabKeys.WATERFALL);
    }
  );

  it.each([
    [TraceLayoutTabKeys.LOGS, makeEapMeta({logsCount: 0, metricsCount: 1})],
    [TraceLayoutTabKeys.METRICS, makeEapMeta({logsCount: 1, metricsCount: 0})],
  ])(
    'does not preserve %s while loading when trace meta reports no tab data',
    (tabSlugFromUrl, meta) => {
      expect(
        getInitialTab({
          isLoading: true,
          meta,
          sections,
          tabOptions: [],
          tabSlugFromUrl,
        }).slug
      ).toBe(TraceLayoutTabKeys.WATERFALL);
    }
  );

  it('does not preserve trace-dependent tabs while loading', () => {
    expect(
      getInitialTab({
        isLoading: true,
        sections,
        tabOptions: [],
        tabSlugFromUrl: TraceLayoutTabKeys.PROFILES,
      }).slug
    ).toBe(TraceLayoutTabKeys.WATERFALL);
  });
});
