import {useLayoutEffect} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {useDismissable} from 'sentry/components/banner';
import {LoadingContainer} from 'sentry/components/loading/loadingContainer';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconClose} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DashboardDetailWithInjectedProps as DashboardDetail} from 'sentry/views/dashboards/detail';
import {
  DashboardState,
  type DashboardDetails,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

import {PREBUILT_DASHBOARDS, PrebuiltDashboardId} from './utils/prebuiltConfigs';

type PrebuiltDashboardRendererProps = {
  prebuiltId: PrebuiltDashboardId;
  additionalGlobalFilters?: GlobalFilter[];
  storageNamespace?: string;
};

export function PrebuiltDashboardRenderer({
  prebuiltId,
  additionalGlobalFilters,
  storageNamespace,
}: PrebuiltDashboardRendererProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const prebuiltDashboard = PREBUILT_DASHBOARDS[prebuiltId];
  const {dashboard: populatedPrebuiltDashboard, isLoading} =
    useGetPrebuiltDashboard(prebuiltId);

  const dashboardId = populatedPrebuiltDashboard?.id;

  const insightsToDashboardsEnabled = organization.features.includes(
    'insights-to-dashboards-ui-rollout'
  );

  useLayoutEffect(() => {
    if (!dashboardId || !insightsToDashboardsEnabled) {
      return;
    }
    trackAnalytics('dashboards_views.insights_redirect', {
      organization,
      dashboard_id: dashboardId,
      prebuilt_id: prebuiltId,
    });
    navigate(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/`,
        query: extractSelectionParameters(location.query),
      }),
      {replace: true}
    );
  }, [
    dashboardId,
    insightsToDashboardsEnabled,
    organization,
    prebuiltId,
    navigate,
    location.query,
  ]);

  const {title, filters} = prebuiltDashboard;
  const widgets = populatedPrebuiltDashboard?.widgets ?? prebuiltDashboard.widgets;

  // Merge the dashboard's built-in filters with any additional global filters.
  // Overrides replace matching filters in-place (by tag key + dataset) to preserve order.
  // Filters with no match in the base list are appended at the end.
  const mergedFilters: DashboardFilters = {...filters};

  if (additionalGlobalFilters) {
    const filterKey = (f: GlobalFilter) => `${f.tag.key}:${f.dataset}`;
    const overridesByKey = new Map(additionalGlobalFilters.map(f => [filterKey(f), f]));
    const usedKeys = new Set<string>();

    const baseFilters = filters?.globalFilter ?? [];
    mergedFilters.globalFilter = baseFilters.map(f => {
      const override = overridesByKey.get(filterKey(f));
      if (override) {
        usedKeys.add(filterKey(f));
        return override;
      }
      return f;
    });

    // Append any additional filters that didn't match a base filter
    for (const f of additionalGlobalFilters) {
      if (!usedKeys.has(filterKey(f))) {
        mergedFilters.globalFilter.push(f);
      }
    }
  }

  const dashboard: DashboardDetails = {
    id: `prebuilt-dashboard-${prebuiltId}`,
    prebuiltId,
    title,
    widgets,
    dateCreated: '',
    filters: mergedFilters,
    projects: undefined,
  };

  const pageFilters = usePageFilters();
  const isSentryEmployee = useIsSentryEmployee();
  const [dismissed, dismiss] = useDismissable('agents-overview-seer-data-banner');
  const isAiAgentsOverview = prebuiltId === PrebuiltDashboardId.AI_AGENTS_OVERVIEW;
  const showSeerDataBanner =
    isSentryEmployee &&
    !dismissed &&
    pageFilters.selection.projects.includes(6178942) &&
    isAiAgentsOverview;
  const showDashboardMigrationAlert = Boolean(dashboardId);
  const hasPageAlerts = showDashboardMigrationAlert || showSeerDataBanner;

  const pageAlerts = hasPageAlerts ? (
    <Stack gap="lg">
      {showDashboardMigrationAlert ? (
        <Alert variant="info" showIcon>
          {tct(
            'Insights pages are moving to Dashboards. Same functionality you love with more customization (and a less cheesy name). [link:View this page on Dashboards]',
            {
              link: (
                <Link
                  to={{
                    pathname: `/organizations/${organization.slug}/dashboard/${dashboardId}/`,
                    query: extractSelectionParameters(location.query),
                  }}
                />
              ),
            }
          )}
        </Alert>
      ) : null}

      {showSeerDataBanner ? (
        <Alert
          variant="warning"
          trailingItems={
            <Button
              aria-label="Dismiss"
              icon={<IconClose />}
              size="xs"
              onClick={dismiss}
            />
          }
        >
          SENTRY EMPLOYEES: Transaction size limits make seer instrumentation incomplete.
          Data shown here does not reflect actual state.
        </Alert>
      ) : null}
    </Stack>
  ) : null;

  return (
    <LoadingContainer isLoading={isLoading} showChildrenWhileLoading={false}>
      <DashboardDetail
        dashboard={dashboard}
        dashboards={[]}
        initialState={DashboardState.EMBEDDED}
        pageAlerts={pageAlerts}
        storageNamespace={storageNamespace}
      />
    </LoadingContainer>
  );
}
