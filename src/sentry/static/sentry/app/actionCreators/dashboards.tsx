import {Client} from 'app/api';
import {t} from 'app/locale';
import {addErrorMessage} from 'app/actionCreators/indicator';
// import {UserDashboard} from 'app/views/dashboardsV2/types';

export function createDashboard(api: Client, orgId: string): Promise<undefined> {
  const promise: Promise<undefined> = api.requestPromise(
    `/organizations/${orgId}/dashboards/`,
    {
      method: 'POST',
      data: {title: 'my own dashboard'},
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
