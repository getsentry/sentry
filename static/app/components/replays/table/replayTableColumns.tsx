import type {ReactNode} from 'react';

import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import type {ReplayRecordNestedFieldName} from 'sentry/views/replays/types';

interface ReplayTableColumn {
  name: string;
  sortKey: undefined | ReplayRecordNestedFieldName;
  tooltip?: ReactNode;
}

export const ReplayActivityColumn: ReplayTableColumn = {
  name: t('Activity'),
  tooltip: t(
    'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
  ),
  sortKey: 'activity',
};

export const ReplayBrowserColumn: ReplayTableColumn = {
  name: t('Browser'),
  sortKey: 'browser.name',
};

export const ReplayCountDeadClicksColumn: ReplayTableColumn = {
  name: t('Dead clicks'),
  tooltip: tct(
    'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
    {
      minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
      link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
    }
  ),
  sortKey: 'count_dead_clicks',
};

export const ReplayCountErrorsColumn: ReplayTableColumn = {
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
  sortKey: 'count_errors',
};

export const ReplayCountRageClicksColumn: ReplayTableColumn = {
  name: t('Rage clicks'),
  tooltip: tct(
    'A rage click is 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
    {
      minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
      link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
    }
  ),
  sortKey: 'count_rage_clicks',
};

export const ReplayDurationColumn: ReplayTableColumn = {
  name: t('Duration'),
  sortKey: 'duration',
};

export const ReplayOSColumn: ReplayTableColumn = {
  name: t('OS'),
  sortKey: 'os.name',
};

export const ReplayPlayPauseColumn: ReplayTableColumn = {
  name: '',
  sortKey: undefined,
};

export const ReplaySessionColumn: ReplayTableColumn = {
  name: t('Replay'),
  sortKey: 'started_at',
};

export const ReplaySlowestTransactionColumn: ReplayTableColumn = {
  name: t('Slowest Transaction'),
  sortKey: undefined,
};
