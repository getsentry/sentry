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
  CheckStatus.SUCCESS,
  CheckStatus.MISSED_WINDOW,
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
  [CheckStatusReason.FAILURE]: check =>
    // TODO(epurkhiser): Not all failures include a HTTP status code, we
    // should display the `status_reason_description` somewhere (this is not
    // currently exposed to the frontend)
    check.httpStatusCode ? t('HTTP %s', check.httpStatusCode) : null,
  [CheckStatusReason.TIMEOUT]: _ => t('Timeout'),
  [CheckStatusReason.DNS_ERROR]: _ => t('DNS Error'),
  [CheckStatusReason.TLS_ERROR]: _ => t('TLS Connection Error'),
  [CheckStatusReason.CONNECTION_ERROR]: _ => t('Connection Error'),
  [CheckStatusReason.REDIRECT_ERROR]: _ => t('Too Many Redirects'),
  [CheckStatusReason.MISS_BACKFILL]: _ => t('No Data'),
};

export const tickStyle: TickStyle<CheckStatus> = theme => ({
  [CheckStatus.SUCCESS]: {
    labelColor: theme.colors.green500,
    tickColor: theme.colors.green400,
  },
  [CheckStatus.FAILURE]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
    hatchTick: theme.colors.red200,
  },
  [CheckStatus.FAILURE_INCIDENT]: {
    labelColor: theme.colors.red500,
    tickColor: theme.colors.red400,
  },
  [CheckStatus.MISSED_WINDOW]: {
    labelColor: theme.colors.gray500,
    tickColor: theme.colors.gray400,
    hatchTick: theme.colors.gray200,
  },
});
