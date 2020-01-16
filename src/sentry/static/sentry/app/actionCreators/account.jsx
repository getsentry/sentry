import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import ConfigStore from 'app/stores/configStore';

export function disconnectIdentity(identity) {
  const api = new Client();
  const request = api.requestPromise(`/users/me/social-identities/${identity.id}/`, {
    method: 'DELETE',
  });

  request
    .then(() => {
      addSuccessMessage(`Disconnected ${identity.providerLabel}`);
    })
    .catch(() => {
      addErrorMessage('Error disconnecting identity');
    });

  return request;
}

export function updateUser(user) {
  // Ideally we'd fire an action but this is gonna get refactored soon anyway
  ConfigStore.set('user', user);
}

export function logout(api) {
  return api.requestPromise('/auth/', {
    method: 'DELETE',
  });
}

export function removeAuthenticator(api, userId, authId) {
  return api.requestPromise(`/users/${userId}/authenticators/${authId}/`, {
    method: 'DELETE',
  });
}
