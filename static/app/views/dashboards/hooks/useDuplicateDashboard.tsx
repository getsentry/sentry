import {useCallback, useState} from 'react';

import {createDashboard, fetchDashboard} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import type {DashboardDetails, DashboardListItem} from 'sentry/views/dashboards/types';
import {cloneDashboard} from 'sentry/views/dashboards/utils';
import {
  PREBUILT_DASHBOARDS,
  type PrebuiltDashboardId,
} from 'sentry/views/dashboards/utils/prebuiltConfigs';

interface UseDuplicateDashboardProps {
  onSuccess?: (copiedDashboard: DashboardDetails) => void;
}

export function useDuplicateDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const organization = useOrganization();

  const duplicateDashboard = useCallback(
    async (dashboard: DashboardListItem, viewType: 'table' | 'grid') => {
      try {
        const dashboardDetail = dashboard.prebuiltId
          ? {id: '-1', ...PREBUILT_DASHBOARDS[dashboard.prebuiltId]}
          : await fetchDashboard(api, organization.slug, dashboard.id);

        const newDashboard = cloneDashboard(dashboardDetail);
        newDashboard.widgets.map(widget => (widget.id = undefined));
        const copiedDashboard = await createDashboard(
          api,
          organization.slug,
          newDashboard,
          true
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
    [api, organization, onSuccess]
  );

  return duplicateDashboard;
}

export function useDuplicatePrebuiltDashboard({onSuccess}: UseDuplicateDashboardProps) {
  const api = useApi();
  const organization = useOrganization();
  const [isLoading, setIsLoading] = useState(false);

  const duplicatePrebuiltDashboard = useCallback(
    async (prebuiltId?: PrebuiltDashboardId) => {
      if (!prebuiltId) {
        throw new Error(
          'Prebuilt dashboard ID is required to duplicate a prebuilt dashboard'
        );
      }
      const prebuiltDashboard = {id: '-1', ...PREBUILT_DASHBOARDS[prebuiltId]};
      try {
        const newDashboard = cloneDashboard(prebuiltDashboard);
        delete newDashboard.prebuiltId;
        newDashboard.title = `${newDashboard.title} copy`;
        newDashboard.widgets.map(widget => (widget.id = undefined));
        setIsLoading(true);
        const copiedDashboard = await createDashboard(
          api,
          organization.slug,
          newDashboard,
          true
        );
        onSuccess?.(copiedDashboard);
        addSuccessMessage(t('Dashboard duplicated'));
      } catch (e) {
        addErrorMessage(t('Error duplicating Dashboard'));
      } finally {
        setIsLoading(false);
      }
    },
    [api, organization, onSuccess]
  );

  return {duplicatePrebuiltDashboard, isLoading};
}
