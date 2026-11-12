import type {OnUrlUpdateFunction} from 'nuqs/adapters/testing';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {EAPTraceMeta} from './traceApi/types';
import {TraceTree} from './traceModels/traceTree';
import {
  getInitialTab,
  TraceLayoutTabKeys,
  useTraceLayoutTabs,
} from './useTraceLayoutTabs';
import type {TraceOverviewData} from './useTraceOverviewData';

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
    uptimeCount: 0,
    ...overrides,
  };
}

describe('getInitialTab', () => {
  it.each([
    [TraceLayoutTabKeys.LOGS, {...sections, hasTraceEvents: false, hasLogs: true}],
    [TraceLayoutTabKeys.METRICS, {...sections, hasTraceEvents: false, hasMetrics: true}],
  ])(
    'selects %s when it is the only available non-trace tab',
    (expectedTab, availableSections) => {
      expect(
        getInitialTab({
          isLoading: false,
          sections: availableSections,
          tabOptions: [],
          tabSlugFromUrl: undefined,
        }).slug
      ).toBe(expectedTab);
    }
  );

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
      const organization = OrganizationFixture();
      const {result} = renderHookWithProviders(
        () =>
          useTraceLayoutTabs({
            isLoading: true,
            logsEnabled: true,
            metricsEnabled: true,
            overview: {
              isProjectsLoading: false,
              isRepresentativeLoading: false,
              isTabLoading: true,
              projectIds: [],
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
        {
          organization,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/traces/trace-id/',
              query: {tab: tabSlug},
            },
          },
        }
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

  it.each([
    [TraceLayoutTabKeys.LOGS, 'Logs'],
    [TraceLayoutTabKeys.METRICS, 'Application Metrics'],
  ])(
    'includes only the deep-linked %s tab when availability is unknown',
    (tabSlug, tabLabel) => {
      const organization = OrganizationFixture();
      const {result} = renderHookWithProviders(
        () =>
          useTraceLayoutTabs({
            isLoading: false,
            logsEnabled: true,
            metricsEnabled: true,
            overview: {
              isProjectsLoading: false,
              isRepresentativeLoading: false,
              isTabLoading: false,
              projectIds: [],
              logs: {
                availability: 'unknown',
                count: undefined,
                representative: undefined,
              },
              metrics: {
                availability: 'unknown',
                count: undefined,
              },
            },
            tree: new TraceTree().build(),
          }),
        {
          organization,
          initialRouterConfig: {
            location: {
              pathname: '/organizations/org-slug/traces/trace-id/',
              query: {tab: tabSlug},
            },
          },
        }
      );

      expect(result.current.currentTab).toBe(tabSlug);
      expect(result.current.tabOptions).toContainEqual({label: tabLabel, slug: tabSlug});
      expect(result.current.tabOptions.map(tab => tab.slug)).not.toContain(
        tabSlug === TraceLayoutTabKeys.LOGS
          ? TraceLayoutTabKeys.METRICS
          : TraceLayoutTabKeys.LOGS
      );
    }
  );

  it('does not include optional tabs with unknown availability by default', () => {
    const organization = OrganizationFixture();
    const {result} = renderHookWithProviders(
      () =>
        useTraceLayoutTabs({
          isLoading: false,
          logsEnabled: true,
          metricsEnabled: true,
          overview: {
            isProjectsLoading: false,
            isRepresentativeLoading: false,
            isTabLoading: false,
            projectIds: [],
            logs: {
              availability: 'unknown',
              count: undefined,
              representative: undefined,
            },
            metrics: {
              availability: 'unknown',
              count: undefined,
            },
          },
          tree: new TraceTree().build(),
        }),
      {organization}
    );

    expect(result.current.tabOptions.map(tab => tab.slug)).toEqual([
      TraceLayoutTabKeys.WATERFALL,
    ]);
  });

  it.each([TraceLayoutTabKeys.LOGS, TraceLayoutTabKeys.METRICS])(
    'switches directly from loading to the resolved %s tab',
    resolvedTab => {
      const organization = OrganizationFixture();
      let isLoading = true;
      let overview: TraceOverviewData = {
        isProjectsLoading: false,
        isRepresentativeLoading: false,
        isTabLoading: true,
        projectIds: [],
        logs: {
          availability: 'loading',
          count: undefined,
          representative: undefined,
        },
        metrics: {
          availability: 'loading',
          count: undefined,
        },
      };
      const renderedTabs: TraceLayoutTabKeys[] = [];
      const {result, rerender} = renderHookWithProviders(
        () => {
          const tabsConfig = useTraceLayoutTabs({
            isLoading,
            logsEnabled: true,
            metricsEnabled: true,
            overview,
            tree: TraceTree.Empty(),
          });
          renderedTabs.push(tabsConfig.currentTab);
          return tabsConfig;
        },
        {organization}
      );

      expect(result.current.currentTab).toBe(TraceLayoutTabKeys.WATERFALL);

      renderedTabs.length = 0;
      isLoading = false;
      overview = {
        isProjectsLoading: false,
        isRepresentativeLoading: false,
        isTabLoading: false,
        projectIds: [],
        logs: {
          availability: resolvedTab === TraceLayoutTabKeys.LOGS ? 'present' : 'absent',
          count: resolvedTab === TraceLayoutTabKeys.LOGS ? 1 : 0,
          representative: undefined,
        },
        metrics: {
          availability: resolvedTab === TraceLayoutTabKeys.METRICS ? 'present' : 'absent',
          count: resolvedTab === TraceLayoutTabKeys.METRICS ? 1 : 0,
        },
      };
      rerender();

      expect(renderedTabs).not.toContain(TraceLayoutTabKeys.WATERFALL);
      expect(result.current.currentTab).toBe(resolvedTab);
    }
  );

  it('replaces the tab in the URL and keeps other params when a tab is chosen', async () => {
    const onUrlUpdate = jest.fn<
      ReturnType<OnUrlUpdateFunction>,
      Parameters<OnUrlUpdateFunction>
    >();
    const {result, router} = renderHookWithProviders(
      () =>
        useTraceLayoutTabs({
          isLoading: false,
          logsEnabled: true,
          metricsEnabled: true,
          overview: {
            isProjectsLoading: false,
            isRepresentativeLoading: false,
            isTabLoading: false,
            projectIds: [],
            logs: {availability: 'present', count: 1, representative: undefined},
            metrics: {availability: 'absent', count: 0},
          },
          tree: new TraceTree().build(),
        }),
      {
        organization: OrganizationFixture(),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/traces/trace-id/',
            query: {node: 'span-abc', tab: TraceLayoutTabKeys.WATERFALL},
          },
        },
        onNuqsUrlUpdate: onUrlUpdate,
      }
    );

    act(() => result.current.onTabChange(TraceLayoutTabKeys.LOGS));

    await waitFor(() => {
      expect(router.location.query).toEqual({
        node: 'span-abc',
        tab: TraceLayoutTabKeys.LOGS,
      });
    });
    expect(result.current.currentTab).toBe(TraceLayoutTabKeys.LOGS);
    expect(onUrlUpdate).toHaveBeenCalledWith(
      expect.objectContaining({options: expect.objectContaining({history: 'replace'})})
    );
  });

  it('reads the first tab when the URL repeats it', () => {
    const {result} = renderHookWithProviders(
      () =>
        useTraceLayoutTabs({
          isLoading: false,
          logsEnabled: true,
          metricsEnabled: true,
          overview: {
            isProjectsLoading: false,
            isRepresentativeLoading: false,
            isTabLoading: false,
            projectIds: [],
            logs: {availability: 'present', count: 1, representative: undefined},
            metrics: {availability: 'absent', count: 0},
          },
          tree: new TraceTree().build(),
        }),
      {
        organization: OrganizationFixture(),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/traces/trace-id/',
            query: {tab: [TraceLayoutTabKeys.LOGS, TraceLayoutTabKeys.WATERFALL]},
          },
        },
      }
    );

    expect(result.current.currentTab).toBe(TraceLayoutTabKeys.LOGS);
  });
});
