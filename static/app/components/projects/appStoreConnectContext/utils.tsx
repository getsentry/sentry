import {t} from 'app/locale';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';

export const appStoreConnectAlertMessage = {
  iTunesSessionInvalid: t(
    'The iTunes session of your configured App Store Connect needs to be refreshed.'
  ),
  appStoreCredentialsInvalid: t(
    'The credentials of your configured App Store Connect are invalid.'
  ),
};

export function getAppConnectStoreUpdateAlertMessage(
  appConnectValidationData: AppStoreConnectValidationData
) {
  if (appConnectValidationData.promptItunesSession) {
    return appStoreConnectAlertMessage.iTunesSessionInvalid;
  }
  if (appConnectValidationData.appstoreCredentialsValid === false) {
    return appStoreConnectAlertMessage.appStoreCredentialsInvalid;
  }
  return undefined;
}
