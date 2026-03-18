import {useCallback, useState} from 'react';

import {createDashboard, fetchDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails, DashboardListItem} from 'sentry/views/dashboards/types';
import {cloneDashboard} from 'sentry/views/dashboards/utils';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {resolveLinkedDashboardIds} from 'sentry/views/dashboards/utils/usePopulateLinkedDashboards';

interface UseDuplicateDashboardProps {
  onSuccess?: (copiedDashboard: DashboardDetails) => void;
}

export function useDuplicateDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const duplicateDashboard = useCallback(
    async (dashboard: DashboardListItem, viewType: 'table' | 'grid') => {
      try {
        const dashboardDetail = dashboard.prebuiltId
          ? await resolveLinkedDashboardIds({
              queryClient,
              orgSlug: organization.slug,
              dashboard: toPrebuiltDashboardDetails(dashboard.prebuiltId),
            })
          : await fetchDashboard(api, organization.slug, dashboard.id);

        const newDashboard = cloneDashboard(dashboardDetail);
        newDashboard.title = `${newDashboard.title} copy`;
        newDashboard.widgets.map(widget => (widget.id = undefined));
        const copiedDashboard = await createDashboard(
          api,
          organization.slug,
          newDashboard
        );
        trackAnalytics('dashboards_manage.duplicate', {
          organization,
          dashboard_id: parseInt(dashboard.id, 10),
          view_type: viewType,
        });
        onSuccess?.(copiedDashboard);
        addSuccessMessage(t('Dashboard duplicated'));
      } catch (e) {
        addErrorMessage(t('Error duplicating Dashboard'));
      }
    },
    [api, queryClient, organization, onSuccess]
  );

  return duplicateDashboard;
}

export function useDuplicatePrebuiltDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const [isLoading, setIsLoading] = useState(false);

  const duplicatePrebuiltDashboard = useCallback(
    async (prebuiltId?: PrebuiltDashboardId) => {
      if (!prebuiltId) {
        throw new Error(
          'Prebuilt dashboard ID is required to duplicate a prebuilt dashboard'
        );
      }
      try {
        setIsLoading(true);
        const dashboardDetail = await resolveLinkedDashboardIds({
          queryClient,
          orgSlug: organization.slug,
          dashboard: toPrebuiltDashboardDetails(prebuiltId),
        });
        const newDashboard = cloneDashboard(dashboardDetail);
        delete newDashboard.prebuiltId;
        newDashboard.title = `${newDashboard.title} copy`;
        newDashboard.widgets.map(widget => (widget.id = undefined));
        const copiedDashboard = await createDashboard(
          api,
          organization.slug,
          newDashboard
        );
        onSuccess?.(copiedDashboard);
        addSuccessMessage(t('Dashboard duplicated'));
      } catch (e) {
        addErrorMessage(t('Error duplicating Dashboard'));
      } finally {
        setIsLoading(false);
      }
    },
    [api, queryClient, organization, onSuccess]
  );

  return {duplicatePrebuiltDashboard, isLoading};
}

/**
 * Prebuilt dashboard configs don't have an `id` since they aren't persisted.
 * `cloneDashboard` and `createDashboard` require `DashboardDetails` (which includes `id`),
 * so we attach a placeholder. Neither function actually uses the `id` value, so
 * we should update those types.
 */
function toPrebuiltDashboardDetails(prebuiltId: PrebuiltDashboardId): DashboardDetails {
  return {id: '-1', ...PREBUILT_DASHBOARDS[prebuiltId]};
}
