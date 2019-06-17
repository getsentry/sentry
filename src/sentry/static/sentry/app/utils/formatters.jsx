import {get} from 'lodash';

import {t} from 'app/locale';

export function userDisplayName(user) {
  let displayName = String(get(user, 'name', t('Unknown author'))).trim();

  if (displayName.length <= 0) {
    displayName = t('Unknown author');
  }

  const email = String(get(user, 'email', '')).trim();

  if (email.length > 0 && email !== displayName) {
    displayName += ' (' + user.email + ')';
  }
  return displayName;
}
