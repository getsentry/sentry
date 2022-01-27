import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import {User, UserIdentityConfig} from 'sentry/types';

export async function disconnectIdentity(
  identity: UserIdentityConfig,
  onSuccess: {(): void}
) {
  const api = new Client();

  try {
    await api.requestPromise(
      `/users/me/user-identities/${identity.category}/${identity.id}/`,
      {
        method: 'DELETE',
      }
    );
  } catch {
    addErrorMessage('Error disconnecting identity');
    return;
  }

  addSuccessMessage(`Disconnected ${identity.provider.name}`);
  onSuccess();
}

export function updateUser(user: User) {
  const previousUser = ConfigStore.get('user');

  // If the user changed their theme preferences, we should also update
  // the config store
  if (
    previousUser.options.theme !== user.options.theme &&
    user.options.theme !== 'system'
  ) {
    ConfigStore.set('theme', user.options.theme);
  }

  // Ideally we'd fire an action but this is gonna get refactored soon anyway
  ConfigStore.set('user', user);
}

export function logout(api: Client) {
  return api.requestPromise('/auth/', {method: 'DELETE'});
}

export function removeAuthenticator(api: Client, userId: string, authId: string) {
  return api.requestPromise(`/users/${userId}/authenticators/${authId}/`, {
    method: 'DELETE',
  });
}
