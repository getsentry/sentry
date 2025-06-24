import type {GridColumnOrder} from 'sentry/components/gridEditable';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';

export enum ReplayColumn {
  ACTIVITY = 'activity',
  BROWSER = 'browser',
  COUNT_DEAD_CLICKS = 'countDeadClicks',
  COUNT_ERRORS = 'countErrors',
  COUNT_RAGE_CLICKS = 'countRageClicks',
  DURATION = 'duration',
  OS = 'os',
  PLAY_PAUSE = 'play_pause',
  REPLAY = 'replay',
  SLOWEST_TRANSACTION = 'slowestTransaction',
}

export const ReplayGridColumns: Record<ReplayColumn, GridColumnOrder<ReplayColumn>> = {
  [ReplayColumn.ACTIVITY]: {
    key: ReplayColumn.ACTIVITY,
    name: t('Activity'),
    tooltip: t(
      'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
    ),
    width: 104,
  },
  [ReplayColumn.BROWSER]: {
    key: ReplayColumn.BROWSER,
    name: t('Browser'),
    width: 81,
  },
  [ReplayColumn.COUNT_DEAD_CLICKS]: {
    key: ReplayColumn.COUNT_DEAD_CLICKS,
    name: t('Dead clicks'),
    tooltip: tct(
      'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
      {
        minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
        link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
      }
    ),
    width: 117,
  },
  [ReplayColumn.COUNT_ERRORS]: {
    key: ReplayColumn.COUNT_ERRORS,
    name: t('Errors'),
    tooltip: tct(
      'The error count only reflects errors generated within the Replay SDK. [inboundFilters:Inbound Filters] may have prevented those errors from being saved. [perfIssue:Performance] and other [replayIssue:error] types may have been added afterwards.',
      {
        inboundFilters: (
          <ExternalLink href="https://docs.sentry.io/concepts/data-management/filtering/" />
        ),
        replayIssue: (
          <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/replay-issues/" />
        ),
        perfIssue: (
          <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/performance-issues/" />
        ),
      }
    ),
    width: 87,
  },
  [ReplayColumn.COUNT_RAGE_CLICKS]: {
    key: ReplayColumn.COUNT_RAGE_CLICKS,
    name: t('Rage clicks'),
    tooltip: tct(
      'A rage click is 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
      {
        minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
        link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
      }
    ),
  },
  [ReplayColumn.DURATION]: {
    key: ReplayColumn.DURATION,
    name: t('Duration'),
  },
  [ReplayColumn.OS]: {
    key: ReplayColumn.OS,
    name: t('OS'),
  },
  [ReplayColumn.PLAY_PAUSE]: {
    key: ReplayColumn.PLAY_PAUSE,
    name: '',
  },
  [ReplayColumn.REPLAY]: {
    key: ReplayColumn.REPLAY,
    name: t('Replay'),
  },
  [ReplayColumn.SLOWEST_TRANSACTION]: {
    key: ReplayColumn.SLOWEST_TRANSACTION,
    name: t('Slowest Transaction'),
  },
};
