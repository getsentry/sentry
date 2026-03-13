import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {useDismissable} from 'sentry/components/banner';
import LoadingContainer from 'sentry/components/loading/loadingContainer';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconClose} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {useIsSentryEmployee} from 'sentry/utils/useIsSentryEmployee';
import {useOrganization} from 'sentry/utils/useOrganization';
import DashboardDetail from 'sentry/views/dashboards/detail';
import {
  DashboardState,
  type DashboardDetails,
  type DashboardFilters,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {useResolveLinkedDashboardIds} from 'sentry/views/dashboards/utils/resolveLinkedDashboardIds';

import {usePrebuiltDashboardId} from './hooks/usePrebuiltDashboardId';
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
  const prebuiltConfig = PREBUILT_DASHBOARDS[prebuiltId];

  // Pass a minimal DashboardDetails with just the prebuiltId — the hook
  // looks up widgets from PREBUILT_DASHBOARDS internally.
  const shellDashboard: DashboardDetails = {
    id: `prebuilt-dashboard-${prebuiltId}`,
    prebuiltId,
    title: prebuiltConfig.title,
    widgets: [],
    dateCreated: '',
    filters: prebuiltConfig.filters,
    projects: undefined,
  };

  const {dashboard: resolvedDashboard, isLoading: isResolvingLinks} =
    useResolveLinkedDashboardIds(shellDashboard);

  // Separately fetch the real DB ID for this prebuilt dashboard (for the alert link).
  const dashboardId = usePrebuiltDashboardId(prebuiltId);

  // Merge the dashboard's built-in filters with any additional global filters.
  // Overrides replace matching filters in-place (by tag key + dataset) to preserve order.
  // Filters with no match in the base list are appended at the end.
  const mergedFilters: DashboardFilters = {...prebuiltConfig.filters};

  if (additionalGlobalFilters) {
    const filterKey = (f: GlobalFilter) => `${f.tag.key}:${f.dataset}`;
    const overridesByKey = new Map(additionalGlobalFilters.map(f => [filterKey(f), f]));
    const usedKeys = new Set<string>();

    const baseFilters = prebuiltConfig.filters?.globalFilter ?? [];
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

  // Build the final dashboard using resolved widgets (which include both the
  // prebuilt config widgets and resolved linked dashboard IDs).
  const dashboard: DashboardDetails = {
    ...resolvedDashboard,
    filters: mergedFilters,
  } as DashboardDetails;

  const pageFilters = usePageFilters();
  const isSentryEmployee = useIsSentryEmployee();
  const [dismissed, dismiss] = useDismissable('agents-overview-seer-data-banner');
  const isAiAgentsOverview = prebuiltId === PrebuiltDashboardId.AI_AGENTS_OVERVIEW;
  const showSeerDataBanner =
    isSentryEmployee &&
    !dismissed &&
    pageFilters.selection.projects.includes(6178942) &&
    isAiAgentsOverview;

  return (
    <LoadingContainer isLoading={isResolvingLinks} showChildrenWhileLoading={false}>
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

      {showSeerDataBanner && (
        <Container padding="xl 3xl 0">
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
            SENTRY EMPLOYEES: Transaction size limits make seer instrumentation
            incomplete. Data shown here does not reflect actual state.
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
