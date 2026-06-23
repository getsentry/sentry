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
  [CheckStatusReason.FAILURE]: check => {
    if (check.assertionFailureData) {
      return t('Assertions Failed');
    }

    // TODO(epurkhiser): Not all failures include a HTTP status code, we
    // should display the `status_reason_description` somewhere (this is not
    // currently exposed to the frontend)
    return check.httpStatusCode ? t('HTTP %s', check.httpStatusCode) : null;
  },
  [CheckStatusReason.TIMEOUT]: _ => t('Timeout'),
  [CheckStatusReason.DNS_ERROR]: _ => t('DNS Error'),
  [CheckStatusReason.TLS_ERROR]: _ => t('TLS Connection Error'),
  [CheckStatusReason.CONNECTION_ERROR]: _ => t('Connection Error'),
  [CheckStatusReason.REDIRECT_ERROR]: _ => t('Too Many Redirects'),
  [CheckStatusReason.MISS_PRODUCED]: _ => t('No Result Produced'),
  [CheckStatusReason.MISS_BACKFILL]: _ => t('Backfilled'),
  [CheckStatusReason.ASSERTION_COMPILATION_ERROR]: _ => t('Invalid Assertion'),
  [CheckStatusReason.ASSERTION_EVALUATION_ERROR]: _ => t('Assertion Error'),
};

export const tickStyle: TickStyle<CheckStatus> = theme => ({
  [CheckStatus.SUCCESS]: {
    labelColor: theme.tokens.content.success,
    tickColor: theme.tokens.dataviz.semantic.good,
  },
  [CheckStatus.FAILURE]: {
    labelColor: theme.tokens.content.danger,
    tickColor: theme.tokens.dataviz.semantic.bad,
    hatchTick: theme.tokens.border.danger.muted,
  },
  [CheckStatus.FAILURE_INCIDENT]: {
    labelColor: theme.tokens.content.danger,
    tickColor: theme.tokens.dataviz.semantic.bad,
  },
  [CheckStatus.MISSED_WINDOW]: {
    labelColor: theme.tokens.content.secondary,
    tickColor: theme.tokens.dataviz.semantic.neutral,
    hatchTick: theme.tokens.border.neutral.muted,
  },
});
