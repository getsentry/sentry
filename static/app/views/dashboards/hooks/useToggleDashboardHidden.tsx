import {useMutation, useQueryClient} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {dashboardsApiOptions} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardListItem} from 'sentry/views/dashboards/types';

type ToggleHiddenVariables = {
  dashboard: DashboardListItem;
  shouldHide: boolean;
};

/**
 * Toggles whether a dashboard is hidden from the current user's dashboards list.
 */
export function useToggleDashboardHidden() {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutate} = useMutation({
    mutationFn: ({dashboard, shouldHide}: ToggleHiddenVariables) =>
      fetchMutation({
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/hidden/',
          {path: {organizationIdOrSlug: organization.slug, dashboardId: dashboard.id}}
        ),
        method: 'PUT',
        data: {shouldHide},
      }),

    onError: (_error, {shouldHide}) => {
      addErrorMessage(
        shouldHide ? t('Unable to hide dashboard') : t('Unable to unhide dashboard')
      );
    },

    onSuccess: (_data, {dashboard, shouldHide}) => {
      addSuccessMessage(shouldHide ? t('Dashboard hidden') : t('Dashboard unhidden'));
      trackAnalytics('dashboards_manage.toggle_hidden', {
        organization,
        dashboard_id: dashboard.id,
        hidden: shouldHide,
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries(dashboardsApiOptions(organization));
    },
  });

  return mutate;
}
