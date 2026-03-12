import {useCallback, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {createDashboard, fetchDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {fetchDataQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardsLayout} from 'sentry/views/dashboards/manage/types';
import type {DashboardDetails, DashboardListItem} from 'sentry/views/dashboards/types';
import {cloneDashboard} from 'sentry/views/dashboards/utils';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboard,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {
  getLinkedPrebuiltIds,
  makeLinkedDashboardsQueryKey,
  resolveLinkedDashboardIds,
} from 'sentry/views/dashboards/utils/resolveLinkedDashboardIds';

type DuplicateDashboardInput = DashboardDetails | DashboardListItem | PrebuiltDashboard;

interface UseDuplicateDashboardProps {
  onSuccess?: (copiedDashboard: DashboardDetails) => void;
}

export function useDuplicateDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const duplicateDashboard = useCallback(
    async (dashboard: DuplicateDashboardInput, viewType: DashboardsLayout) => {
      try {
        setIsLoading(true);

        const dashboardDetail = await toDashboardDetails(
          api,
          organization.slug,
          dashboard
        );

        const prebuiltIds = getLinkedPrebuiltIds(dashboardDetail);
        const resolved =
          prebuiltIds.length > 0
            ? resolveLinkedDashboardIds(
                dashboardDetail,
                await fetchLinkedDashboards(queryClient, organization.slug, prebuiltIds)
              )
            : dashboardDetail;

        const newDashboard = cloneDashboard(resolved);
        newDashboard.title = `${newDashboard.title} copy`;
        delete newDashboard.prebuiltId;
        newDashboard.widgets.map(widget => (widget.id = undefined));
        const copiedDashboard = await createDashboard(
          api,
          organization.slug,
          newDashboard
        );
        const dashboardId = 'id' in dashboard ? parseInt(dashboard.id, 10) : NaN;
        trackAnalytics('dashboards_manage.duplicate', {
          organization,
          dashboard_id: dashboardId,
          view_type: viewType,
        });
        onSuccess?.(copiedDashboard);
        addSuccessMessage(t('Dashboard duplicated'));
      } catch (e) {
        addErrorMessage(t('Error duplicating Dashboard'));
      } finally {
        setIsLoading(false);
      }
    },
    [api, organization, queryClient, onSuccess]
  );

  return {duplicateDashboard, isLoading};
}

/**
 * Resolves any dashboard input to a full DashboardDetails with widgets.
 *
 * - DashboardDetails: used directly
 * - DashboardListItem: fetches full details from the API
 * - PrebuiltDashboard (or any input with prebuiltId): merges widget config
 *   from PREBUILT_DASHBOARDS
 */
async function toDashboardDetails(
  api: ReturnType<typeof useApi>,
  orgSlug: string,
  dashboard: DuplicateDashboardInput
): Promise<DashboardDetails> {
  // Prebuilt dashboards: widgets come from the frontend config, not the DB.
  if (dashboard.prebuiltId) {
    const config = PREBUILT_DASHBOARDS[dashboard.prebuiltId];
    const id = 'id' in dashboard ? dashboard.id : '-1';
    return {...config, ...dashboard, id, widgets: config.widgets};
  }

  // DashboardDetails: already has widgets (PrebuiltDashboard is excluded by the
  // prebuiltId check above, but TS can't narrow the union, so we assert).
  if ('widgets' in dashboard) {
    return dashboard as DashboardDetails;
  }

  // DashboardListItem: fetch full details from API
  return fetchDashboard(api, orgSlug, dashboard.id);
}

async function fetchLinkedDashboards(
  queryClient: ReturnType<typeof useQueryClient>,
  orgSlug: string,
  prebuiltIds: ReturnType<typeof getLinkedPrebuiltIds>
): Promise<DashboardDetails[]> {
  const [dashboards] = await queryClient.fetchQuery({
    queryKey: makeLinkedDashboardsQueryKey(orgSlug, prebuiltIds) as ApiQueryKey,
    queryFn: fetchDataQuery<DashboardDetails[]>,
    staleTime: Infinity,
  });
  return dashboards;
}
