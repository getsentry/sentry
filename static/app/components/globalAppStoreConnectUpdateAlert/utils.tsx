import moment from 'moment';

import {t, tct} from 'app/locale';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';

export function getAppConnectStoreUpdateAlertMessage(
  appConnectValidationData: AppStoreConnectValidationData
) {
  if (appConnectValidationData.itunesSessionValid === false) {
    return t('The iTunes session of your configured App Store Connect has expired.');
  }

  if (appConnectValidationData.appstoreCredentialsValid === false) {
    return t('The credentials of your configured App Store Connect are invalid.');
  }

  const itunesSessionRefreshAt = appConnectValidationData.itunesSessionRefreshAt;

  if (!itunesSessionRefreshAt) {
    return undefined;
  }

  const foreseenDaysLeftForTheITunesSessionToExpire = moment(itunesSessionRefreshAt).diff(
    moment(),
    'days'
  );

  if (foreseenDaysLeftForTheITunesSessionToExpire === 0) {
    return t(
      'We recommend that you update the iTunes session of your configured App Store Connect as it will likely expire today.'
    );
  }

  if (foreseenDaysLeftForTheITunesSessionToExpire === 1) {
    return t(
      'We recommend that you update the iTunes session of your configured App Store Connect as it will likely expire tomorrow.'
    );
  }

  if (foreseenDaysLeftForTheITunesSessionToExpire <= 6) {
    return tct(
      'We recommend that you update the iTunes session of your configured App Store Connect as it will likely expire in [days] days.',
      {
        days: foreseenDaysLeftForTheITunesSessionToExpire,
      }
    );
  }

  return undefined;
}
