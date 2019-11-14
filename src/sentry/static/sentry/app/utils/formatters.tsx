import get from 'lodash/get';

import {t} from 'app/locale';
import {CommitAuthor, User} from 'app/types';

export function userDisplayName(user: User | CommitAuthor): string {
  let displayName = String(get(user, 'name', t('Unknown author'))).trim();

  if (displayName.length <= 0) {
    displayName = t('Unknown author');
  }

  const email = String(get(user, 'email', '')).trim();

  if (email.length > 0 && email !== displayName) {
    displayName += ' (' + email + ')';
  }
  return displayName;
}
