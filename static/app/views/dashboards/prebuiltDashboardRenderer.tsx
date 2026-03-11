import {Alert} from '@sentry/scraps/alert';
import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import DashboardDetail from 'sentry/views/dashboards/detail';
import {
  DashboardState,
  type DashboardDetails,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {useGetPrebuiltDashboard} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

import {PREBUILT_DASHBOARDS, type PrebuiltDashboardId} from './utils/prebuiltConfigs';

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
  const prebuiltDashboard = PREBUILT_DASHBOARDS[prebuiltId];
  const {dashboard: populatedPrebuiltDashboard, isLoading} =
    useGetPrebuiltDashboard(prebuiltId);

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

  const dashboardId = populatedPrebuiltDashboard?.id;

  return (
    <LoadingContainer isLoading={isLoading} showChildrenWhileLoading={false}>
      {dashboardId && (
        <Container padding="xl 3xl 0">
          <Alert variant="info" showIcon>
            {tct(
              'Insights pages are moving to Dashboards. Same functionality you love with more customization (and a less cheesy name). [link:View this page on Dashboards]',
              {
                link: (
                  <Link
                    to={`/organizations/${organization.slug}/dashboards/${dashboardId}/`}
                  />
                ),
              }
            )}
          </Alert>
        </Container>
      )}
      <DashboardDetail
        dashboard={dashboard}
        dashboards={[]}
        initialState={DashboardState.EMBEDDED}
        storageNamespace={storageNamespace}
      />
    </LoadingContainer>
  );
}
