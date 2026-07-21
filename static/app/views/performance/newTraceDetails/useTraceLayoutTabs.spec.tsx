import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import type {EAPTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/types';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  getInitialTab,
  TraceLayoutTabKeys,
  useTraceLayoutTabs,
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
    [{...sections, hasTraceEvents: false, hasLogs: true}, TraceLayoutTabKeys.LOGS],
    [{...sections, hasTraceEvents: false, hasMetrics: true}, TraceLayoutTabKeys.METRICS],
  ])('selects the only available non-trace tab', (availableSections, expectedTab) => {
    expect(
      getInitialTab({
        isLoading: false,
        sections: availableSections,
        tabOptions: [],
        tabSlugFromUrl: undefined,
      }).slug
    ).toBe(expectedTab);
  });

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

describe('useTraceLayoutTabs', () => {
  it.each([
    [TraceLayoutTabKeys.LOGS, 'Logs'],
    [TraceLayoutTabKeys.METRICS, 'Application Metrics'],
  ])(
    'includes the deep-linked %s tab while its availability is loading',
    (tabSlug, tabLabel) => {
      setWindowLocation(
        `http://localhost/organizations/org-slug/traces/trace-id/?tab=${tabSlug}`
      );
      const organization = OrganizationFixture();
      const {result} = renderHookWithProviders(
        () =>
          useTraceLayoutTabs({
            isLoading: true,
            logsEnabled: true,
            metricsEnabled: true,
            overview: {
              isRepresentativeLoading: false,
              isTabLoading: true,
              logs: {
                availability: 'loading',
                count: undefined,
                representative: undefined,
              },
              metrics: {
                availability: 'loading',
                count: undefined,
              },
            },
            tree: new TraceTree().build(),
          }),
        {organization}
      );

      expect(result.current.currentTab).toBe(tabSlug);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tabOptions).toContainEqual({
        label: tabLabel,
        slug: tabSlug,
      });
      expect(result.current.tabOptions.map(tab => tab.slug)).not.toContain(
        tabSlug === TraceLayoutTabKeys.LOGS
          ? TraceLayoutTabKeys.METRICS
          : TraceLayoutTabKeys.LOGS
      );
    }
  );
});
