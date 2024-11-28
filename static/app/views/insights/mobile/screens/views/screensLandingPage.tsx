import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabbedCodeSnippet} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {NewQuery} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {SETUP_CONTENT as TTFD_SETUP} from 'sentry/views/insights/mobile/screenload/data/setupContent';
import {ScreensOverview} from 'sentry/views/insights/mobile/screens/components/screensOverview';
import VitalCard from 'sentry/views/insights/mobile/screens/components/vitalCard';
import {VitalDetailPanel} from 'sentry/views/insights/mobile/screens/components/vitalDetailPanel';
import {Referrer} from 'sentry/views/insights/mobile/screens/referrers';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_FEATURE,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/screens/settings';
import {
  getColdAppStartPerformance,
  getDefaultMetricPerformance,
  getWarmAppStartPerformance,
  type MetricValue,
  STATUS_UNKNOWN,
  type VitalItem,
  type VitalStatus,
} from 'sentry/views/insights/mobile/screens/utils';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

export function ScreensLandingPage() {
  const moduleName = ModuleName.MOBILE_SCREENS;
  const location = useLocation();
  const organization = useOrganization();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const handleProjectChange = useCallback(() => {
    browserHistory.replace({
      ...location,
      query: {
        ...omit(location.query, ['primaryRelease', 'secondaryRelease']),
      },
    });
  }, [location]);
  const {selection} = usePageFilters();

  const vitalItems: VitalItem[] = [
    {
      title: t('Cold App Start'),
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
      field: 'avg(measurements.app_start_cold)',
      dataset: DiscoverDatasets.METRICS,
      getStatus: getColdAppStartPerformance,
    },
    {
      title: t('Warm App Start'),
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
      field: 'avg(measurements.app_start_warm)',
      dataset: DiscoverDatasets.METRICS,
      getStatus: getWarmAppStartPerformance,
    },
    {
      title: t('Slow Frames'),
      description: t('Slow frames ratio'),
      docs: t(
        'The number of slow frames divided by the total number of frames rendered.'
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
      field: `avg(mobile.slow_frames)`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Frozen Frames'),
      description: t('Average number of frozen frames'),
      docs: t(
        'The number of frozen frames divided by the total number of frames rendered.'
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
      field: `avg(mobile.frozen_frames)`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Frame Delay'),
      description: t('Average frame delay'),
      docs: t('The average delay divided by the total rendering time.'),
      setup: undefined,
      platformDocLinks: {
        Android: 'https://developer.android.com/topic/performance/vitals/render',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
        iOS: 'https://docs.sentry.io/platforms/apple/guides/ios/tracing/instrumentation/automatic-instrumentation/#slow-and-frozen-frames',
      },
      field: `avg(mobile.frames_delay)`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('TTID'),
      description: t('Average time to intial display.'),
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
      field: `avg(measurements.time_to_initial_display)`,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('TTFD'),
      description: t('Average time to full display.'),
      docs: t('The average time it takes until your app is drawing the full content.'),
      setup: <TabbedCodeSnippet tabs={TTFD_SETUP} />,
      platformDocLinks: {
        Android:
          'https://developer.android.com/topic/performance/vitals/launch-time#time-full',
      },
      sdkDocLinks: {
        Android:
          'https://docs.sentry.io/platforms/android/tracing/instrumentation/automatic-instrumentation/#time-to-initial-display',
        iOS: 'https://docs.sentry.io/platforms/apple/features/experimental-features/',
      },
      field: `avg(measurements.time_to_full_display)`,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getDefaultMetricPerformance,
    },
  ];

  const metricsFields: string[] = new Array();
  const spanMetricsFields: string[] = new Array();
  const [state, setState] = useState<{
    status: VitalStatus | undefined;
    vital: VitalItem | undefined;
  }>({status: undefined, vital: undefined});

  vitalItems.forEach(element => {
    if (element.dataset === DiscoverDatasets.METRICS) {
      metricsFields.push(element.field);
    } else if (element.dataset === DiscoverDatasets.SPANS_METRICS) {
      spanMetricsFields.push(element.field);
    }
  });

  const query = new MutableSearch(['transaction.op:ui.load']);
  if (isProjectCrossPlatform) {
    query.addFilterValue('os.name', selectedPlatform);
  }
  const metricsQuery: NewQuery = {
    name: '',
    fields: metricsFields,
    query: query.formatString(),
    dataset: DiscoverDatasets.METRICS,
    version: 2,
    projects: selection.projects,
  };
  const metricsQueryView: EventView = EventView.fromNewQueryWithLocation(
    metricsQuery,
    location
  );

  const metricsResult = useDiscoverQuery({
    eventView: metricsQueryView,
    location,
    orgSlug: organization.slug,
    limit: 25,
    referrer: Referrer.SCREENS_METRICS,
  });

  const spanMetricsQuery: NewQuery = {
    name: '',
    fields: spanMetricsFields,
    query: query.formatString(),
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
  };

  const spanMetricsQueryView = EventView.fromNewQueryWithLocation(
    spanMetricsQuery,
    location
  );

  const spanMetricsResult = useDiscoverQuery({
    eventView: spanMetricsQueryView,
    location,
    orgSlug: organization.slug,
    limit: 25,
    referrer: Referrer.SCREENS_METRICS,
  });

  const metricValueFor = (item: VitalItem): MetricValue | undefined => {
    const dataset =
      item.dataset === DiscoverDatasets.METRICS ? metricsResult : spanMetricsResult;

    if (dataset.data) {
      const row = dataset.data.data[0];
      const units = dataset.data.meta?.units;
      const fieldTypes = dataset.data.meta?.fields;

      const value = row[item.field];
      const unit = units?.[item.field];
      const fieldType = fieldTypes?.[item.field];

      return {
        type: fieldType,
        unit: unit,
        value: value,
      };
    }

    return undefined;
  };

  return (
    <ModulePageProviders moduleName="mobile-screens" features={[MODULE_FEATURE]}>
      <Layout.Page>
        <PageAlertProvider>
          <MobileHeader
            headerTitle={
              <Fragment>
                {MODULE_TITLE}
                <PageHeadingQuestionTooltip
                  docsUrl={MODULE_DOC_LINK}
                  title={MODULE_DESCRIPTION}
                />
              </Fragment>
            }
            headerActions={isProjectCrossPlatform && <PlatformSelector />}
            module={moduleName}
          />
          <Layout.Body>
            <Layout.Main fullWidth>
              <Container>
                <PageFilterBar condensed>
                  <ProjectPageFilter onChange={handleProjectChange} />
                  <EnvironmentPageFilter />
                  <DatePageFilter />
                </PageFilterBar>
              </Container>
              <PageAlert />
              <ErrorBoundary mini>
                <Container>
                  <Flex data-test-id="mobile-screens-top-metrics">
                    {vitalItems.map(item => {
                      const metricValue = metricValueFor(item);
                      const status =
                        (metricValue && item.getStatus(metricValue)) ?? STATUS_UNKNOWN;

                      return (
                        <VitalCard
                          onClick={() => {
                            setState({
                              vital: item,
                              status: status,
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
            </Layout.Main>
          </Layout.Body>
          <VitalDetailPanel
            vital={state.vital}
            status={state.status}
            onClose={() => {
              setState({vital: undefined, status: undefined});
            }}
          />
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
