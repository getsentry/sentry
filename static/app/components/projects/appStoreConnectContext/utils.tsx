import {
  getAppStoreValidationErrorMessage,
  ValidationErrorDetailed,
} from 'app/components/modals/debugFileCustomRepository/appStoreConnect/utils';
import {AppStoreConnectCredentialsStatus} from 'app/types/debugFiles';

export function areAppStoreConnectCredentialsValid(
  credentialsStatus: AppStoreConnectCredentialsStatus | undefined
): boolean {
  return credentialsStatus?.status === 'valid';
}

export function getAppConnectStoreUpdateAlertMessage(
  credentialsStatus: AppStoreConnectCredentialsStatus
): string | undefined {
  if (areAppStoreConnectCredentialsValid(credentialsStatus)) {
    return undefined;
  }
  return getAppStoreValidationErrorMessage(credentialsStatus as ValidationErrorDetailed);
}
