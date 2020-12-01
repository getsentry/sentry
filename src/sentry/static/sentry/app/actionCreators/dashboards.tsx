import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {
  DashboardListItem,
  OrgDashboard,
  OrgDashboardResponse,
  OrgDashboardUpdate,
} from 'app/views/dashboardsV2/types';

export function createDashboard(
  api: Client,
  orgId: string,
  newDashboard: DashboardListItem
): Promise<OrgDashboardResponse> {
  const {title, widgets} = newDashboard;

  const promise: Promise<OrgDashboardResponse> = api.requestPromise(
    `/organizations/${orgId}/dashboards/`,
    {
      method: 'POST',
      data: {title, widgets},
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      addErrorMessage(errorResponse);
    } else {
      addErrorMessage(t('Unable to create dashboard'));
    }
  });

  return promise;
}

export function updateDashboard(
  api: Client,
  orgId: string,
  dashboard: OrgDashboard
): Promise<OrgDashboardResponse> {
  const data: OrgDashboardUpdate = {
    title: dashboard.title,
    widgets: dashboard.widgets,
  };

  const promise: Promise<OrgDashboardResponse> = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboard.id}/`,
    {
      method: 'PUT',
      data,
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      addErrorMessage(errorResponse);
    } else {
      addErrorMessage(t('Unable to update dashboard'));
    }
  });

  return promise;
}

export function deleteDashboard(
  api: Client,
  orgId: string,
  dashboardId: string
): Promise<undefined> {
  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboardId}/`,
    {
      method: 'DELETE',
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      addErrorMessage(errorResponse);
    } else {
      addErrorMessage(t('Unable to delete dashboard'));
    }
  });

  return promise;
}
