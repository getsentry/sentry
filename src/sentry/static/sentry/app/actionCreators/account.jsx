import {Client} from '../api';
import ConfigStore from '../stores/configStore';
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

export function updateUser(user) {
  // Ideally we'd fire an action but this is gonna get refactored soon anyway
  ConfigStore.set('user', user);
}
