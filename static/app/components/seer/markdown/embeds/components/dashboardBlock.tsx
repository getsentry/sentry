import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconDashboard} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {dashboardDetailsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {MetricsResultsMetaProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';

const MAX_PREVIEW_WIDGETS = 4;

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
  widgetLegendState,
}: {
  dashboard: DashboardDetails;
  selection: PageFilters;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
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
            tableItemLimit={Math.min(widget.limit ?? 5, 5)}
            widget={{...widget}}
            widgetLegendState={widgetLegendState}
            widgetLimitReached={false}
          />
        </DashboardsMEPProvider>
      </ErrorBoundary>
    </Container>
  );
}

export function DashboardPreview({
  dashboard,
  href,
}: {
  dashboard: DashboardDetails;
  href: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection: currentSelection} = usePageFilters();
  const previewWidgets = dashboard.widgets.slice(0, MAX_PREVIEW_WIDGETS);
  const remainingWidgets = dashboard.widgets.length - previewWidgets.length;
  const selection = hasSavedPageFilters(dashboard)
    ? getSavedFiltersAsPageFilters(dashboard)
    : currentSelection;
  const widgetLegendState = useMemo(
    () =>
      new WidgetLegendSelectionState({
        dashboard,
        location,
        navigate,
        organization,
      }),
    [dashboard, location, navigate, organization]
  );

  if (dashboard.widgets.length === 0) {
    return <Text variant="muted">{t('This dashboard has no widgets.')}</Text>;
  }

  return (
    <Stack gap="md">
      <MetricsResultsMetaProvider>
        <MEPSettingProvider forceTransactions={false}>
          <WidgetQueryQueueProvider>
            <Grid
              columns={{'2xs': 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))'}}
              gap="md"
            >
              {previewWidgets.map((widget, index) => (
                <DashboardWidgetPreview
                  key={widget.id ?? `${widget.title}-${index}`}
                  dashboard={dashboard}
                  selection={selection}
                  widget={widget}
                  widgetLegendState={widgetLegendState}
                />
              ))}
            </Grid>
          </WidgetQueryQueueProvider>
        </MEPSettingProvider>
      </MetricsResultsMetaProvider>
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
  const dashboard = data ? getDashboardPreview(data) : undefined;

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
          <Text variant="muted">{t('Unable to load dashboard details.')}</Text>
        ) : (
          <DashboardPreview dashboard={dashboard} href={href} />
        )}
      </Stack>
    </Container>
  );
}
