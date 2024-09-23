import {useCallback} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import Duration from 'sentry/components/duration';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatFloat} from 'sentry/utils/number/formatFloat';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreensOverview} from 'sentry/views/insights/mobile/screens/components/screensOverview';
import VitalCard from 'sentry/views/insights/mobile/screens/components/vitalCard';
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
} from 'sentry/views/insights/mobile/screens/utils';
import {type InsightLandingProps, ModuleName} from 'sentry/views/insights/types';

export function ScreensLandingPage({disableHeader}: InsightLandingProps) {
  const moduleName = ModuleName.MOBILE_SCREENS;
  const crumbs = useModuleBreadcrumbs(moduleName);
  const location = useLocation();
  const organization = useOrganization();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();
  // const {primaryRelease, secondaryRelease} = useReleaseSelection();

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
      field: 'avg(measurements.app_start_cold)',
      dataset: DiscoverDatasets.METRICS,
      getStatus: getColdAppStartPerformance,
    },
    {
      title: t('Warm App Start'),
      description: t('Average Warm App Start duration'),
      field: 'avg(measurements.app_start_warm)',
      dataset: DiscoverDatasets.METRICS,
      getStatus: getWarmAppStartPerformance,
    },
    {
      title: t('Slow Frames'),
      description: t('Average number of slow frames'),
      field: `avg(mobile.slow_frames)`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Frozen Frames'),
      description: t('Average number of frozen frames'),
      field: `avg(mobile.frozen_frames)`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('Frame Delay'),
      description: t('Average frame delay'),
      field: `avg(mobile.frames_delay)`,
      dataset: DiscoverDatasets.SPANS_METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('TTID'),
      description: t('Average time to intial display.'),
      field: `avg(measurements.time_to_initial_display)`,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getDefaultMetricPerformance,
    },
    {
      title: t('TTFD'),
      description: t('Average time to full display.'),
      field: `avg(measurements.time_to_full_display)`,
      dataset: DiscoverDatasets.METRICS,
      getStatus: getDefaultMetricPerformance,
    },
  ];

  const metricsFields: string[] = new Array();
  const spanMetricsFields: string[] = new Array();

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

  const formattedMetricValueFor = (metric: MetricValue): React.ReactNode => {
    if (typeof metric.value === 'number' && metric.type === 'duration' && metric.unit) {
      return (
        <Duration
          seconds={
            (metric.value * ((metric.unit && DURATION_UNITS[metric.unit]) ?? 1)) / 1000
          }
          fixedDigits={2}
          abbreviation
        />
      );
    }

    if (typeof metric.value === 'number' && metric.type === 'number') {
      return <span>{formatFloat(metric.value, 2)}</span>;
    }

    return <span>{metric.value}</span>;
  };

  return (
    <ModulePageProviders moduleName="mobile-screens" features={[MODULE_FEATURE]}>
      <Layout.Page>
        <PageAlertProvider>
          {!disableHeader && (
            <Layout.Header>
              <Layout.HeaderContent>
                <Breadcrumbs crumbs={crumbs} />
                <Layout.Title>
                  {MODULE_TITLE}
                  <PageHeadingQuestionTooltip
                    docsUrl={MODULE_DOC_LINK}
                    title={MODULE_DESCRIPTION}
                  />
                </Layout.Title>
              </Layout.HeaderContent>
              <Layout.HeaderActions>
                <ButtonBar gap={1}>
                  {isProjectCrossPlatform && <PlatformSelector />}
                  <FeedbackWidgetButton />
                </ButtonBar>
              </Layout.HeaderActions>
            </Layout.Header>
          )}

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
                      const formattedValue: React.ReactNode =
                        metricValue && formattedMetricValueFor(metricValue);

                      return (
                        <VitalCard
                          key={item.field}
                          title={item.title}
                          description={item.description}
                          statusLabel={status.description}
                          status={status.score}
                          formattedValue={formattedValue}
                        />
                      );
                    })}
                  </Flex>
                  <ScreensOverview />
                </Container>
              </ErrorBoundary>
            </Layout.Main>
          </Layout.Body>
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
