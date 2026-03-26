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
    async (dashboardId?: string) => {
      if (!dashboardId) {
        throw new Error('Dashboard ID is required to duplicate a prebuilt dashboard');
      }
      try {
        setIsLoading(true);

        // Fetch the saved dashboard to get the prebuilt ID and saved filters.
        // Widgets are not stored for prebuilt dashboards, so we pull those
        // from the static config and resolve any linked dashboard placeholders.
        const savedDashboard = await fetchDashboard(api, organization.slug, dashboardId);

        if (!savedDashboard.prebuiltId) {
          throw new Error('Saved dashboard is missing its prebuilt ID');
        }

        const dashboardDetail = await resolveLinkedDashboardIds({
          queryClient,
          orgSlug: organization.slug,
          dashboard: toPrebuiltDashboardDetails(savedDashboard.prebuiltId),
        });

        const newDashboard = cloneDashboard(dashboardDetail);
        delete newDashboard.prebuiltId;
        newDashboard.title = `${newDashboard.title} copy`;
        newDashboard.widgets.map(widget => (widget.id = undefined));
        if (savedDashboard.filters !== undefined) {
          newDashboard.filters = savedDashboard.filters;
        }
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
// trivial change for CI testing
