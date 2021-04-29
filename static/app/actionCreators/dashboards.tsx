import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {DashboardDetails, Widget} from 'app/views/dashboardsV2/types';

export function createDashboard(
  api: Client,
  orgId: string,
  newDashboard: DashboardDetails,
  duplicate?: boolean
): Promise<DashboardDetails> {
  const {title, widgets} = newDashboard;

  const promise: Promise<DashboardDetails> = api.requestPromise(
    `/organizations/${orgId}/dashboards/`,
    {
      method: 'POST',
      data: {title, widgets, duplicate},
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

export function fetchDashboard(
  api: Client,
  orgId: string,
  dashboardId: string
): Promise<DashboardDetails> {
  const promise: Promise<DashboardDetails> = api.requestPromise(
    `/organizations/${orgId}/dashboards/${dashboardId}/`,
    {
      method: 'GET',
    }
  );

  promise.catch(response => {
    const errorResponse = response?.responseJSON ?? null;

    if (errorResponse) {
      addErrorMessage(errorResponse);
    } else {
      addErrorMessage(t('Unable to load dashboard'));
    }
  });
  return promise;
}

export function updateDashboard(
  api: Client,
  orgId: string,
  dashboard: DashboardDetails
): Promise<DashboardDetails> {
  const data = {
    title: dashboard.title,
    widgets: dashboard.widgets,
  };

  const promise: Promise<DashboardDetails> = api.requestPromise(
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

export function validateWidget(
  api: Client,
  orgId: string,
  widget: Widget
): Promise<undefined> {
  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/dashboards/widgets/`,
    {
      method: 'POST',
      data: widget,
    }
  );
  return promise;
}
