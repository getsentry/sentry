import moment from 'moment';

import {t} from 'app/locale';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';

export const appStoreConnectAlertMessage = {
  iTunesSessionInvalid: t(
    'The iTunes session of your configured App Store Connect has expired.'
  ),
  appStoreCredentialsInvalid: t(
    'The credentials of your configured App Store Connect are invalid.'
  ),
  isTodayAfterItunesSessionRefreshAt: t(
    'The iTunes session of your configured App Store Connect will likely expire soon.'
  ),
};

export function getAppConnectStoreUpdateAlertMessage(
  appConnectValidationData: AppStoreConnectValidationData
) {
  if (appConnectValidationData.itunesSessionValid === false) {
    return appStoreConnectAlertMessage.iTunesSessionInvalid;
  }

  if (appConnectValidationData.appstoreCredentialsValid === false) {
    return appStoreConnectAlertMessage.appStoreCredentialsInvalid;
  }

  const itunesSessionRefreshAt = appConnectValidationData.itunesSessionRefreshAt;

  if (!itunesSessionRefreshAt) {
    return undefined;
  }

  const isTodayAfterItunesSessionRefreshAt = moment().isAfter(
    moment(itunesSessionRefreshAt)
  );

  if (!isTodayAfterItunesSessionRefreshAt) {
    return undefined;
  }

  return appStoreConnectAlertMessage.isTodayAfterItunesSessionRefreshAt;
}
