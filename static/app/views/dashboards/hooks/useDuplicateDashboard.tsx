import {useCallback} from 'react';

import {createDashboard, fetchDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';
import {cloneDashboard} from 'sentry/views/dashboards/utils';

interface UseDuplicateDashboardProps {
  onSuccess: () => void;
}

export function useDuplicateDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const organization = useOrganization();

  const duplicateDashboard = useCallback(
    async (dashboard: DashboardListItem, viewType: 'table' | 'grid') => {
      try {
        const dashboardDetail = await fetchDashboard(
          api,
          organization.slug,
          dashboard.id
        );
        const newDashboard = cloneDashboard(dashboardDetail);
        newDashboard.widgets.map(widget => (widget.id = undefined));
        await createDashboard(api, organization.slug, newDashboard, true);
        trackAnalytics('dashboards_manage.duplicate', {
          organization,
          dashboard_id: parseInt(dashboard.id, 10),
          view_type: viewType,
        });
        onSuccess();
        addSuccessMessage(t('Dashboard duplicated'));
      } catch (e) {
        addErrorMessage(t('Error duplicating Dashboard'));
      }
    },
    [api, organization, onSuccess]
  );

  return duplicateDashboard;
}
