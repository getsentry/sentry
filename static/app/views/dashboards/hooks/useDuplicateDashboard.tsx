import {useCallback, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {createDashboard, fetchDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardsLayout} from 'sentry/views/dashboards/manage/types';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {cloneDashboard} from 'sentry/views/dashboards/utils';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {resolveLinkedDashboardIds} from 'sentry/views/dashboards/utils/resolveLinkedDashboardIds';

interface UseDuplicateDashboardProps {
  onSuccess?: (copiedDashboard: DashboardDetails) => void;
}

export function useDuplicateDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const duplicateDashboard = useCallback(
    async (
      dashboard: {id: string; prebuiltId?: PrebuiltDashboardId},
      viewType: DashboardsLayout
    ) => {
      try {
        setIsLoading(true);
        const dashboardDetail = dashboard.prebuiltId
          ? {id: '-1', ...PREBUILT_DASHBOARDS[dashboard.prebuiltId]}
          : await fetchDashboard(api, organization.slug, dashboard.id);

        const resolved = dashboard.prebuiltId
          ? await resolveLinkedDashboardIds(
              queryClient,
              organization.slug,
              dashboardDetail
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
        trackAnalytics('dashboards_manage.duplicate', {
          organization,
          dashboard_id: parseInt(dashboard.id, 10),
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
