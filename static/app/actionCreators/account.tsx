import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {ConfigStore} from 'sentry/stores/configStore';
import type {UserIdentityConfig} from 'sentry/types/auth';
import type {User} from 'sentry/types/user';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import type {ChangeAvatarUser} from 'sentry/views/settings/account/accountDetails';

export async function disconnectIdentity(
  identity: UserIdentityConfig,
  onSuccess: () => void
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

type LogoutOptions = {
  redirect?: boolean;
  redirectUrl?: string;
};

export async function logout(
  api: Client,
  {redirect = true, redirectUrl}: LogoutOptions = {}
) {
  const data = await api.requestPromise('/auth/', {method: 'DELETE'});

  if (data?.sloUrl) {
    testableWindowLocation.assign(data.sloUrl);
    return true;
  }

  if (redirect) {
    testableWindowLocation.assign(getRedirectUrl(redirectUrl));
    return true;
  }

  await api.requestPromise('/auth-v2/csrf/');

  return false;
}

function getRedirectUrl(redirectUrl = '/auth/login/') {
  return isDemoModeActive() ? 'https://sentry.io' : redirectUrl;
}

export function removeAuthenticator(api: Client, userId: string, authId: string) {
  return api.requestPromise(`/users/${userId}/authenticators/${authId}/`, {
    method: 'DELETE',
  });
}
