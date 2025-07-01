import type {TickStyle} from 'sentry/components/checkInTimeline/types';
import {t} from 'sentry/locale';
import {
  CheckStatus,
  CheckStatusReason,
  type UptimeCheck,
} from 'sentry/views/alerts/rules/uptime/types';

// Orders the status in terms of ascending precedence for showing to the user
export const checkStatusPrecedent: CheckStatus[] = [
  CheckStatus.FAILURE_INCIDENT,
  CheckStatus.FAILURE,
  CheckStatus.MISSED_WINDOW,
  CheckStatus.SUCCESS,
];

export const statusToText: Record<CheckStatus, string> = {
  [CheckStatus.SUCCESS]: t('Uptime'),
  [CheckStatus.FAILURE]: t('Failure'),
  [CheckStatus.FAILURE_INCIDENT]: t('Downtime'),
  [CheckStatus.MISSED_WINDOW]: t('Unknown'),
};

export const reasonToText: Record<
  CheckStatusReason,
  (check: UptimeCheck) => React.ReactNode
> = {
  [CheckStatusReason.FAILURE]: check => t('HTTP %s', check.httpStatusCode),
  [CheckStatusReason.TIMEOUT]: _ => t('Timeout'),
  [CheckStatusReason.DNS_ERROR]: _ => t('DNS Error'),
  [CheckStatusReason.TLS_ERROR]: _ => t('TLS Connection Error'),
  [CheckStatusReason.CONNECTION_ERROR]: _ => t('Connection Error'),
  [CheckStatusReason.REDIRECT_ERROR]: _ => t('Too Many Redirects'),
};

export const tickStyle: TickStyle<CheckStatus> = theme => ({
  [CheckStatus.SUCCESS]: {
    labelColor: theme.green400,
    tickColor: theme.green300,
  },
  [CheckStatus.FAILURE]: {
    labelColor: theme.red400,
    tickColor: theme.red300,
    hatchTick: theme.red200,
  },
  [CheckStatus.FAILURE_INCIDENT]: {
    labelColor: theme.red400,
    tickColor: theme.red300,
  },
  [CheckStatus.MISSED_WINDOW]: {
    labelColor: theme.gray400,
    tickColor: theme.gray300,
    hatchTick: theme.gray200,
  },
});
