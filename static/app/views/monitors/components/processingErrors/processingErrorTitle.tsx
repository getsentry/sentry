import {t} from 'sentry/locale';
import {ProcessingErrorType} from 'sentry/views/monitors/types';

export function ProcessingErrorTitle({type}: {type: ProcessingErrorType}) {
  switch (type) {
    case ProcessingErrorType.CHECKIN_ENVIRONMENT_MISMATCH:
      return t('Environment mismatch');
    case ProcessingErrorType.CHECKIN_FINISHED:
      return t('Check-in already completed');
    case ProcessingErrorType.CHECKIN_GUID_PROJECT_MISMATCH:
      return t('DSN project mismatch');
    case ProcessingErrorType.CHECKIN_INVALID_DURATION:
      return t('Invalid duration');
    case ProcessingErrorType.CHECKIN_INVALID_GUID:
      return t('Invalid GUID');
    case ProcessingErrorType.CHECKIN_VALIDATION_FAILED:
      return t('Invalid check-in payload');
    case ProcessingErrorType.MONITOR_DISABLED:
      return t('Monitor disabled');
    case ProcessingErrorType.MONITOR_DISABLED_NO_QUOTA:
      return t('Insufficient quota to upsert');
    case ProcessingErrorType.MONITOR_INVALID_CONFIG:
      return t('Invalid monitor payload');
    case ProcessingErrorType.MONITOR_INVALID_ENVIRONMENT:
      return t('Invalid environment');
    case ProcessingErrorType.MONITOR_LIMIT_EXCEEDED:
      return t('Maximum monitor limit exceeded');
    case ProcessingErrorType.MONITOR_NOT_FOUND:
      return t('Monitor not found');
    case ProcessingErrorType.MONITOR_OVER_QUOTA:
      return t('Monitor disabled');
    case ProcessingErrorType.MONITOR_ENVIRONMENT_LIMIT_EXCEEDED:
      return t('Environment limit exceeded');
    case ProcessingErrorType.MONITOR_ENVIRONMENT_RATELIMITED:
      return t('Rate limited');
    case ProcessingErrorType.ORGANIZATION_KILLSWITCH_ENABLED:
      return t('Disabled check-in ingestion');
    default:
      return t('Unknown processing error');
  }
}
