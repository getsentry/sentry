import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCodeSnippet';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDatePageFilterProps} from 'sentry/utils/useDatePageFilterProps';
import {useLocation} from 'sentry/utils/useLocation';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
import {useNavigate} from 'sentry/utils/useNavigate';
import {InsightsEnvironmentSelector} from 'sentry/views/insights/common/components/enviornmentSelector';
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {InsightsProjectSelector} from 'sentry/views/insights/common/components/projectSelector';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useReleaseSelection} from 'sentry/views/insights/common/queries/useReleases';
import {useMobileVitalsDrawer} from 'sentry/views/insights/common/utils/useMobileVitalsDrawer';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {SETUP_CONTENT as TTFD_SETUP} from 'sentry/views/insights/mobile/screenload/data/setupContent';
import {ScreensOverview} from 'sentry/views/insights/mobile/screens/components/screensOverview';
import VitalCard from 'sentry/views/insights/mobile/screens/components/vitalCard';
import {VitalDetailPanel} from 'sentry/views/insights/mobile/screens/components/vitalDetailPanel';
import {Referrer} from 'sentry/views/insights/mobile/screens/referrers';
import {
  getColdAppStartPerformance,
  getDefaultMetricPerformance,
  getWarmAppStartPerformance,
  STATUS_UNKNOWN,
  type MetricValue,
  type VitalItem,
  type VitalStatus,
} from 'sentry/views/insights/mobile/screens/utils';
import {ModuleName} from 'sentry/views/insights/types';

function ScreensLandingPage() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });
  const datePageFilterProps = useDatePageFilterProps(maxPickableDays);

  const moduleName = ModuleName.MOBILE_VITALS;
  const navigate = useNavigate();
  const location = useLocation();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  const {primaryRelease} = useReleaseSelection();

  const handleProjectChange = useCallback(() => {
    navigate(
      {
        ...location,
        query: {
          ...omit(location.query, ['primaryRelease']),
        },
      },
      {replace: true}
    );
  }, [location, navigate]);

  const vitalItems = [
    {
      title: t('Avg. Cold App Start'),
      description: t('Average Cold App Start duration'),
      docs: t(
        'The average cold app start duration. A cold start usually occurs when the app launched for the first time, after a reboot or an app update.'
      ),
      setup: undefined,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#cold',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#app-start-instrumentation',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#app-start-tracing',
      },
      field: 'avg(measurements.app_start_cold)' as const,
      dataset: 'metrics',
      getStatus: getColdAppStartPerformance,
    },
    {
      title: t('Avg. Warm App Start'),
      description: t('Average Warm App Start duration'),
      docs: t(
        'The average warm app start duration. A warm start usually occurs occurs when the app was already launched previously or the process was created beforehand.'
      ),
      setup: undefined,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#warm',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#app-start-instrumentation',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#app-start-tracing',
      },
      field: 'avg(measurements.app_start_warm)' as const,
      dataset: 'metrics',
      getStatus: getWarmAppStartPerformance,
    },
    {
      title: t('Slow Frame Rate'),
      description: t('The percentage of frames that were slow.'),
      docs: t('The percentage of slow frames out of all frames rendered.'),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `division(mobile.slow_frames,mobile.total_frames)` as const,
      dataset: 'spansMetrics',
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Frozen Frame Rate'),
      description: t('The percentage of frames that were frozen.'),
      docs: t('The percentage of frozen frames out of all frames rendered.'),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `division(mobile.frozen_frames,mobile.total_frames)` as const,
      dataset: 'spansMetrics',
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Avg. Frame Delay'),
      description: t('Average frame delay'),
      docs: t(
        'The average total time of delay caused by frames which were not rendered on time.'
      ),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `avg(mobile.frames_delay)` as const,
      dataset: 'spansMetrics',
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Avg. TTID'),
      description: t('Average time to initial display.'),
      docs: t('The average time it takes until your app is drawing the first frame.'),
      setup: undefined,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#time-initial',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#time-to-initial-display',
        iOS: 'https://docs.sentry.io/platforms/apple/features/experimental-features/',
      },
      field: `avg(measurements.time_to_initial_display)` as const,
      dataset: 'metrics',
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Avg. TTFD'),
      description: t('Average time to full display.'),
      docs: t('The average time it takes until your app is drawing the full content.'),
      setup: <TabbedCodeSnippet tabs={TTFD_SETUP} />,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#time-full',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#time-to-full-display',
        iOS: 'https://docs.sentry.io/platforms/apple/features/experimental-features/',
      },
      field: `avg(measurements.time_to_full_display)` as const,
      dataset: 'metrics',
      getStatus: getDefaultMetricPerformance,
    },
  ] satisfies VitalItem[];

  const metricsFields = vitalItems
    .filter(item => item.dataset === 'metrics')
    .map(item => item.field);

  const spanMetricsFields = vitalItems
    .filter(item => item.dataset === 'spansMetrics')
    .map(item => item.field);

  const [state, setState] = useState<{
    status: VitalStatus | undefined;
    vital: VitalItem | undefined;
  }>({status: undefined, vital: undefined});

  const query = new MutableSearch(['transaction.op:[ui.load,navigation]']);
  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }
  if (defined(primaryRelease)) {
    query.addFilterValue('release', primaryRelease);
  }

  // TODO: combine these two queries into one, see DAIN-780
  const metricsResult = useSpans(
    {
      search: query,
      limit: 25,
      fields: metricsFields,
    },
    Referrer.SCREENS_METRICS
  );

  const spanMetricsResult = useSpans(
    {
      search: query,
      limit: 25,
      fields: spanMetricsFields,
    },
    Referrer.SCREENS_SPAN_METRICS
  );

  const metricsData = {...metricsResult.data[0], ...spanMetricsResult.data[0]};
  const metaUnits = {...metricsResult.meta?.units, ...spanMetricsResult.meta?.units};
  const metaFields = {...metricsResult.meta?.fields, ...spanMetricsResult.meta?.fields};

  const {openVitalsDrawer} = useMobileVitalsDrawer({
    Component: <VitalDetailPanel vital={state.vital} status={state.status} />,
    vital: state.vital,
    onClose: () => {
      setState({vital: undefined, status: undefined});
    },
  });

  useEffect(() => {
    if (state.vital) {
      openVitalsDrawer();
    }
  });

  return (
    <ModulePageProviders
      moduleName={ModuleName.MOBILE_VITALS}
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <Layout.Page>
        <PageAlertProvider>
          <ModuleFeature moduleName={moduleName}>
            <Layout.Body>
              <Layout.Main width="full">
                <Container>
                  <ToolRibbon>
                    <PageFilterBar condensed>
                      <InsightsProjectSelector onChange={handleProjectChange} />
                      <InsightsEnvironmentSelector />
                      <DatePageFilter {...datePageFilterProps} />
                    </PageFilterBar>
                    <PageFilterBar condensed>
                      <ReleaseComparisonSelector moduleName={moduleName} />
                    </PageFilterBar>
                  </ToolRibbon>
                </Container>
                <PageAlert />
                <ModulesOnboarding moduleName={moduleName}>
                  <ErrorBoundary mini>
                    <Container>
                      <Flex data-test-id="mobile-vitals-top-metrics">
                        {vitalItems.map(item => {
                          const metricValue: MetricValue = {
                            type: metaFields?.[item.field],
                            value: metricsData?.[item.field],
                            unit: metaUnits?.[item.field],
                          };

                          const status =
                            (metricValue && item.getStatus(metricValue, item.field)) ??
                            STATUS_UNKNOWN;

                          return (
                            <VitalCard
                              onClick={() => {
                                setState({
                                  vital: item,
                                  status,
                                });
                              }}
                              key={item.field}
                              title={item.title}
                              description={item.description}
                              statusLabel={status.description}
                              status={status.score}
                              formattedValue={status.formattedValue}
                            />
                          );
                        })}
                      </Flex>
                      <ScreensOverview />
                    </Container>
                  </ErrorBoundary>
                </ModulesOnboarding>
              </Layout.Main>
            </Layout.Body>
          </ModuleFeature>
        </PageAlertProvider>
      </Layout.Page>
    </ModulePageProviders>
  );
}

const Container = styled('div')`
  margin-bottom: ${space(1)};
`;

const Flex = styled('div')<{gap?: number}>`
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  gap: ${p => (p.gap ? `${p.gap}px` : space(1))};
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: ${space(1)};
`;

export default ScreensLandingPage;
