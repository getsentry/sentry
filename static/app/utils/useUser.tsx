import configStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {User} from 'sentry/types/user';

/**
 * Returns the currently logged in user.
 */
export function useUser(): Readonly<User> {
  // Intentional exception to accessing the deprecated field as we want to
  // deter users from consuming the user differently than through the hook.
  const {user} = useLegacyStore(configStore);
  // @TODO: Return a readonly type as a mechanism to deter users from mutating the
  // user directly. That said, this provides basic type safety and no runtime safety
  // as there are still plenty of ways to mutate the user. The runtime safe way of
  // enforcing this would be via Object.freeze.
  return user;
}
