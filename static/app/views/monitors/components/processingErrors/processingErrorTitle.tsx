import {t} from 'sentry/locale';
import {ProcessingErrorType} from 'sentry/views/monitors/types';

export function ProcessingErrorTitle({type}: {type: ProcessingErrorType}) {
  switch (type) {
    case ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH:
      return t('<placeholder description>');
    case ProcessingErrorType.CHECKIN_FINISHED:
      return t('Check-In has already succeeded or failed.');
    case ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH:
      return t('<placeholder description>');
    case ProcessingErrorType.CHECKIN_INVALID_DURATION:
      return t('<placeholder description>');
    case ProcessingErrorType.CHECKIN_INVALID_GUID:
      return t('<placeholder description>');
    case ProcessingErrorType.CHECKIN_VALIDATION_FAILED:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_DISABLED:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_INVALID_CONFIG:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_LIMIT_EXCEEDED:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_NOT_FOUND:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_OVER_QUOTA:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED:
      return t('<placeholder description>');
    case ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED:
      return t('<placeholder description>');
    case ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED:
      return t('<placeholder description>');
    default:
      return t('Unknown error');
  }
}
