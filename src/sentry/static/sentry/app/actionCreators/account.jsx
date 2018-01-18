import {Client} from '../api';
import IndicatorStore from '../stores/indicatorStore';

export function disconnectIdentity(identity) {
  const api = new Client();
  let request = api.requestPromise(`/users/me/social-identities/${identity.id}/`, {
    method: 'DELETE',
  });

  request
    .then(() => {
      IndicatorStore.addSuccess(`Disconnected ${identity.providerLabel}`);
    })
    .catch(() => {
      IndicatorStore.addError('Error disconnecting identity');
    });

  return request;
}
