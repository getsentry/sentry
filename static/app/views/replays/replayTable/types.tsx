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
  REPLAY = 'replay',
  SLOWEST_TRANSACTION = 'slowestTransaction',
  PLAY_PAUSE = 'play_pause',
}

export const ReplayGridColumns: Record<ReplayColumn, GridColumnOrder<ReplayColumn>> = {
  [ReplayColumn.ACTIVITY]: {
    key: ReplayColumn.ACTIVITY,
    name: ReplayColumn.ACTIVITY,
    tooltip: t(
      'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
    ),
  },
  [ReplayColumn.BROWSER]: {
    key: ReplayColumn.BROWSER,
    name: ReplayColumn.BROWSER,
  },
  [ReplayColumn.COUNT_DEAD_CLICKS]: {
    key: ReplayColumn.COUNT_DEAD_CLICKS,
    name: ReplayColumn.COUNT_DEAD_CLICKS,
    tooltip: tct(
      'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
      {
        minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
        link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
      }
    ),
  },
  [ReplayColumn.COUNT_ERRORS]: {
    key: ReplayColumn.COUNT_ERRORS,
    name: ReplayColumn.COUNT_ERRORS,
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
  },
  [ReplayColumn.COUNT_RAGE_CLICKS]: {
    key: ReplayColumn.COUNT_RAGE_CLICKS,
    name: ReplayColumn.COUNT_RAGE_CLICKS,
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
    name: ReplayColumn.DURATION,
  },
  [ReplayColumn.OS]: {
    key: ReplayColumn.OS,
    name: ReplayColumn.OS,
  },
  [ReplayColumn.REPLAY]: {
    key: ReplayColumn.REPLAY,
    name: ReplayColumn.REPLAY,
  },
  [ReplayColumn.SLOWEST_TRANSACTION]: {
    key: ReplayColumn.SLOWEST_TRANSACTION,
    name: ReplayColumn.SLOWEST_TRANSACTION,
  },
  [ReplayColumn.PLAY_PAUSE]: {
    key: ReplayColumn.PLAY_PAUSE,
    name: ReplayColumn.PLAY_PAUSE,
  },
};
