import {t} from 'app/locale';
import {AppStoreConnectValidationData} from 'app/types/debugFiles';

export const appStoreConnectAlertMessage = {
  appStoreCredentialsInvalid: t(
    'The credentials of your configured App Store Connect are invalid.'
  ),
};

export function getAppConnectStoreUpdateAlertMessage(
  appConnectValidationData: AppStoreConnectValidationData
) {
  if (appConnectValidationData.appstoreCredentialsValid === false) {
    return appStoreConnectAlertMessage.appStoreCredentialsInvalid;
  }
  return undefined;
}
