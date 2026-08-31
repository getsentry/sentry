import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  LocalWidgetLegendSelectionState,
  useLocalWidgetLegendSelectionState,
} from 'sentry/components/seer/markdown/embeds/localWidgetLegendSelectionState';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconDashboard} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {dashboardDetailsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MetricsResultsMetaProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {OnDemandControlProvider} from 'sentry/utils/performance/contexts/onDemandControl';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {getIntervalOptionsForPageFilter} from 'sentry/utils/useChartInterval';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetSyncContextProvider} from 'sentry/views/dashboards/contexts/widgetSyncContext';
import {mergeGlobalFilters} from 'sentry/views/dashboards/globalFilter/utils';
import type {DashboardDetails, Widget} from 'sentry/views/dashboards/types';
import {
  getSavedFiltersAsPageFilters,
  hasSavedPageFilters,
} from 'sentry/views/dashboards/utils';
import {PREBUILT_DASHBOARDS} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {WidgetQueryQueueProvider} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

// Keep the embed compact by showing at most a 2x2 widget grid.
const MAX_PREVIEW_WIDGETS = 4;
// Limit the rows or series fetched inside each previewed widget.
const MAX_PREVIEW_ITEMS_PER_WIDGET = 5;

function getDashboardPreview(dashboard: DashboardDetails): DashboardDetails {
  if (!dashboard.prebuiltId) {
    return dashboard;
  }

  const prebuiltDashboard = PREBUILT_DASHBOARDS[dashboard.prebuiltId];
  if (!prebuiltDashboard) {
    return dashboard;
  }

  const globalFilter = mergeGlobalFilters(
    prebuiltDashboard.filters?.globalFilter ?? [],
    dashboard.filters?.globalFilter ?? []
  );

  return {
    ...dashboard,
    ...prebuiltDashboard,
    id: dashboard.id,
    filters: {...dashboard.filters, globalFilter},
    projects: dashboard.projects,
    environment: dashboard.environment,
    period: dashboard.period,
    start: dashboard.start,
    end: dashboard.end,
    utc: dashboard.utc,
  };
}

function DashboardWidgetPreview({
  dashboard,
  selection,
  widget,
  widgetInterval,
  widgetLegendState,
}: {
  dashboard: DashboardDetails;
  selection: PageFilters;
  widget: Widget;
  widgetInterval: string;
  widgetLegendState: LocalWidgetLegendSelectionState;
}) {
  return (
    <Container minHeight="240px">
      <ErrorBoundary mini>
        <DashboardsMEPProvider>
          <WidgetCard
            disableFullscreen
            disableTableActions
            disableZoom
            dashboardFilters={dashboard.filters}
            selection={selection}
            showContextMenu={false}
            tableItemLimit={Math.min(
              widget.limit ?? MAX_PREVIEW_ITEMS_PER_WIDGET,
              MAX_PREVIEW_ITEMS_PER_WIDGET
            )}
            widget={{...widget}}
            widgetInterval={widgetInterval}
            widgetLegendState={widgetLegendState}
            widgetLimitReached={false}
          />
        </DashboardsMEPProvider>
      </ErrorBoundary>
    </Container>
  );
}

function getDashboardLocation(location: Location, selection: PageFilters): Location {
  return {
    ...location,
    query: {
      ...normalizeDateTimeParams(selection.datetime),
      environment: selection.environments,
      project: selection.projects.map(String),
    },
  };
}

function getDashboardWidgetInterval(selection: PageFilters): string {
  const intervalOptions = getIntervalOptionsForPageFilter(selection.datetime);
  return (
    intervalOptions[intervalOptions.length - 2]?.value ??
    intervalOptions[intervalOptions.length - 1]?.value ??
    '1m'
  );
}

function DashboardPreview({
  dashboard,
  href,
}: {
  dashboard: DashboardDetails;
  href: string;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection: currentSelection} = usePageFilters();
  const previewWidgets = dashboard.widgets.slice(0, MAX_PREVIEW_WIDGETS);
  const remainingWidgets = dashboard.widgets.length - previewWidgets.length;
  const selection = useMemo(
    () =>
      hasSavedPageFilters(dashboard)
        ? getSavedFiltersAsPageFilters(dashboard)
        : currentSelection,
    [currentSelection, dashboard]
  );
  const dashboardLocation = useMemo(
    () => getDashboardLocation(location, selection),
    [location, selection]
  );
  const widgetInterval = useMemo(
    () => getDashboardWidgetInterval(selection),
    [selection]
  );
  const widgetLegendState = useLocalWidgetLegendSelectionState({
    dashboard,
    organization,
  });

  if (dashboard.widgets.length === 0) {
    return <Text variant="muted">{t('This dashboard has no widgets.')}</Text>;
  }

  return (
    <Stack gap="md">
      <OnDemandControlProvider location={dashboardLocation}>
        <MetricsResultsMetaProvider>
          <MetricsCardinalityProvider
            organization={organization}
            location={dashboardLocation}
          >
            <MetricsDataSwitcher location={dashboardLocation}>
              {metricsDataSide => (
                <MEPSettingProvider
                  location={dashboardLocation}
                  forceTransactions={metricsDataSide.forceTransactionsOnly}
                >
                  <WidgetQueryQueueProvider>
                    <WidgetSyncContextProvider>
                      <Grid
                        columns={{
                          '2xs': 'minmax(0, 1fr)',
                          md: 'repeat(2, minmax(0, 1fr))',
                        }}
                        gap="md"
                      >
                        {previewWidgets.map((widget, index) => (
                          <DashboardWidgetPreview
                            key={widget.id ?? `${widget.title}-${index}`}
                            dashboard={dashboard}
                            selection={selection}
                            widget={widget}
                            widgetInterval={widgetInterval}
                            widgetLegendState={widgetLegendState}
                          />
                        ))}
                      </Grid>
                    </WidgetSyncContextProvider>
                  </WidgetQueryQueueProvider>
                </MEPSettingProvider>
              )}
            </MetricsDataSwitcher>
          </MetricsCardinalityProvider>
        </MetricsResultsMetaProvider>
      </OnDemandControlProvider>
      {remainingWidgets > 0 ? (
        <Link to={href}>
          {tn('View %s more widget', 'View %s more widgets', remainingWidgets)}
        </Link>
      ) : null}
    </Stack>
  );
}

export default function DashboardBlock({id, title}: EmbedOutput<'dashboard'>) {
  const organization = useOrganization();
  const href = normalizeUrl(`/organizations/${organization.slug}/dashboard/${id}/`);
  const {data, isError, isPending} = useQuery({
    ...dashboardDetailsApiOptions(organization, id),
    retry: false,
  });
  const dashboard = useMemo(() => (data ? getDashboardPreview(data) : undefined), [data]);

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      padding="md"
      radius="md"
    >
      <Stack gap="md">
        <Flex align="center" justify="between" gap="md" wrap="wrap">
          <ResourceLink
            icon={IconDashboard}
            href={href}
            title={dashboard?.title ?? title ?? t('Dashboard %s', id)}
          />
          {dashboard ? (
            <Text size="sm" variant="muted">
              {tn('%s widget', '%s widgets', dashboard.widgets.length)}
            </Text>
          ) : null}
        </Flex>
        {isPending ? (
          <LoadingIndicator />
        ) : isError || !dashboard ? (
          <Alert role="alert" variant="danger">
            {t('Unable to load dashboard details.')}
          </Alert>
        ) : (
          <DashboardPreview dashboard={dashboard} href={href} />
        )}
      </Stack>
    </Container>
  );
}
