import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import ConfigStore from 'sentry/stores/configStore';
import {User, UserIdentityConfig} from 'sentry/types';
import {ChangeAvatarUser} from 'sentry/views/settings/account/accountDetails';

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

export function updateUser(user: User | ChangeAvatarUser) {
  const previousUser = ConfigStore.get('user');

  // If the user changed their theme preferences, we should also update
  // the config store
  if (
    user.options &&
    previousUser.options.theme !== user.options.theme &&
    user.options.theme !== 'system'
  ) {
    ConfigStore.set('theme', user.options.theme);
  }

  const options = {...previousUser.options, ...user.options};

  // We are merging the types because the avatar endpoint ("/users/me/avatar/") doesn't return a full User
  ConfigStore.set('user', {...previousUser, ...user, options});
}

export function logout(api: Client) {
  return api.requestPromise('/auth/', {method: 'DELETE'});
}

export function removeAuthenticator(api: Client, userId: string, authId: string) {
  return api.requestPromise(`/users/${userId}/authenticators/${authId}/`, {
    method: 'DELETE',
  });
}
