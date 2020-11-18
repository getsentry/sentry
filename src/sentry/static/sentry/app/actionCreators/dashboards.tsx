import {Client} from 'app/api';
import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {DashboardListItem, OrgDashboardResponse} from 'app/views/dashboardsV2/types';

export function createDashboard(
  api: Client,
  orgId: string,
  newDashboard: DashboardListItem
): Promise<OrgDashboardResponse> {
  const promise: Promise<OrgDashboardResponse> = api.requestPromise(
    `/organizations/${orgId}/dashboards/`,
    {
      method: 'POST',
      data: {title: newDashboard.title},
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
