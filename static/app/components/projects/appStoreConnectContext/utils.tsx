import {
  getAppStoreValidationErrorMessage,
  ValidationErrorDetailed,
} from 'app/components/modals/debugFileCustomRepository/appStoreConnect/utils';
import {AppStoreConnectCredentialsStatus} from 'app/types/debugFiles';

export function getAppConnectStoreUpdateAlertMessage(
  credentialsStatus: AppStoreConnectCredentialsStatus
) {
  if (credentialsStatus?.status === 'valid') {
    return undefined;
  }
  return getAppStoreValidationErrorMessage(credentialsStatus as ValidationErrorDetailed);
}
