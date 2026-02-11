import {useCallback} from 'react';

import {deleteDashboard as deleteDashboardAction} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

interface UseDeleteDashboardProps {
  onSuccess: () => void;
}

export function useDeleteDashboard({onSuccess}: UseDeleteDashboardProps) {
  const api = useApi();
  const organization = useOrganization();

  const deleteDashboard = useCallback(
    (dashboard: DashboardListItem, viewType: 'table' | 'grid') => {
      deleteDashboardAction(api, organization.slug, dashboard.id)
        .then(() => {
          trackAnalytics('dashboards_manage.delete', {
            organization,
            dashboard_id: parseInt(dashboard.id, 10),
            view_type: viewType,
          });
          onSuccess();
          addSuccessMessage(t('Dashboard deleted'));
        })
        .catch(() => {
          addErrorMessage(t('Error deleting Dashboard'));
        });
    },
    [api, organization, onSuccess]
  );

  return deleteDashboard;
}
