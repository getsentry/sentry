import type {TickStyle} from 'sentry/components/checkInTimeline/types';
import {t} from 'sentry/locale';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';

// Orders the status in terms of ascending precedence for showing to the user
export const checkStatusPrecedent: CheckStatus[] = [
  CheckStatus.FAILURE_INCIDENT,
  CheckStatus.FAILURE,
  CheckStatus.MISSED_WINDOW,
  CheckStatus.SUCCESS,
];

export const statusToText: Record<CheckStatus, string> = {
  [CheckStatus.SUCCESS]: t('Uptime'),
  [CheckStatus.FAILURE]: t('Intermittent'),
  [CheckStatus.FAILURE_INCIDENT]: t('Downtime'),
  [CheckStatus.MISSED_WINDOW]: t('Unknown'),
};

export const tickStyle: Record<CheckStatus, TickStyle> = {
  [CheckStatus.SUCCESS]: {
    labelColor: 'green400',
    tickColor: 'green300',
  },
  [CheckStatus.FAILURE]: {
    labelColor: 'green300',
    tickColor: 'green200',
  },
  [CheckStatus.FAILURE_INCIDENT]: {
    labelColor: 'red400',
    tickColor: 'red300',
  },
  [CheckStatus.MISSED_WINDOW]: {
    labelColor: 'gray400',
    tickColor: 'gray300',
    hatchTick: 'gray200',
  },
};
