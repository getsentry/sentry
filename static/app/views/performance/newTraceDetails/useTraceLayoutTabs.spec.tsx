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
