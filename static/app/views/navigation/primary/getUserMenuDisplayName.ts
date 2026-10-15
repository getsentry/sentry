import type {User} from 'sentry/types/user';

export function getUserMenuDisplayName(user: Pick<User, 'name' | 'email' | 'username'>) {
  if (user.name && user.name === user.email) {
    return user.email.split('@')[0]?.replaceAll('.', ' ') || user.email;
  }

  return user.name || user.username || user.email;
}
