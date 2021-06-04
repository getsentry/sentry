import moment from 'moment';

import {t, tct} from 'app/locale';

export function getItunesSessionExpirationMessage(expirationDate?: string) {
  if (!expirationDate) {
    return undefined;
  }

  const daysLeftForTheITunesSessionToExpire = moment(expirationDate).diff(
    moment(),
    'days'
  );

  if (daysLeftForTheITunesSessionToExpire === 0) {
    return t('Your App Store Connect session expires today.');
  }

  if (daysLeftForTheITunesSessionToExpire === 1) {
    return t('Your App Store Connect session will expire tomorrow.');
  }

  if (daysLeftForTheITunesSessionToExpire <= 6) {
    return tct('Your App Store Connect session will expire in [days] days.', {
      days: daysLeftForTheITunesSessionToExpire,
    });
  }

  return tct('Your App Store Connect session will expire in [days] days.', {
    days: daysLeftForTheITunesSessionToExpire,
  });
}
