import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {MIN_DEAD_RAGE_CLICK_SDK} from 'sentry/utils/replays/sdkVersions';
import SortableHeader from 'sentry/views/replays/replayTable/sortableHeader';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';

type Props = {
  column: ReplayColumn;
  sort?: Sort;
};

export const colToHeader = {
  [ReplayColumn.ACTIVITY]: t('Activity'),
  [ReplayColumn.BROWSER]: t('Browser'),
  [ReplayColumn.COUNT_DEAD_CLICKS]: t('Dead Clicks'),
  [ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER]: '',
  [ReplayColumn.COUNT_ERRORS]: t('Errors'),
  [ReplayColumn.COUNT_RAGE_CLICKS]: t('Rage Clicks'),
  [ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER]: '',
  [ReplayColumn.DURATION]: t('Duration'),
  [ReplayColumn.OS]: t('OS'),
  [ReplayColumn.REPLAY]: t('Replay'),
  [ReplayColumn.SLOWEST_TRANSACTION]: t('Slowest Transaction'),
  [ReplayColumn.MOST_RAGE_CLICKS]: t('Most Rage Clicks'),
  [ReplayColumn.MOST_DEAD_CLICKS]: t('Most Dead Clicks'),
  [ReplayColumn.MOST_ERRONEOUS_REPLAYS]: t('Most Erroneous Replays'),
};

// GridEditable headers only allow strings, not ReactNodes, so we can't have tooltips anymore.
// If we fully convert to GridEditable, we can delete the following function since
// we'll only need to use the enum to string mapping above.
function HeaderCell({column, sort}: Props) {
  switch (column) {
    case ReplayColumn.ACTIVITY:
      return (
        <SortableHeader
          sort={sort}
          fieldName="activity"
          label={t('Activity')}
          tooltip={t(
            'Activity represents how much user activity happened in a replay. It is determined by the number of errors encountered, duration, and UI events.'
          )}
        />
      );

    case ReplayColumn.BROWSER:
      return <SortableHeader sort={sort} fieldName="browser.name" label={t('Browser')} />;

    case ReplayColumn.COUNT_DEAD_CLICKS:
      return (
        <SortableHeader
          sort={sort}
          fieldName="count_dead_clicks"
          label={t('Dead clicks')}
          tooltip={tct(
            'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
            {
              minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
              link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
            }
          )}
        />
      );

    case ReplayColumn.COUNT_DEAD_CLICKS_NO_HEADER:
      return <SortableHeader label="" />;

    case ReplayColumn.COUNT_ERRORS:
      return <SortableHeader sort={sort} fieldName="count_errors" label={t('Errors')} />;

    case ReplayColumn.COUNT_RAGE_CLICKS:
      return (
        <SortableHeader
          sort={sort}
          fieldName="count_rage_clicks"
          label={t('Rage clicks')}
          tooltip={tct(
            'A rage click is 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
            {
              minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
              link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
            }
          )}
        />
      );

    case ReplayColumn.COUNT_RAGE_CLICKS_NO_HEADER:
      return <SortableHeader label="" />;

    case ReplayColumn.DURATION:
      return <SortableHeader sort={sort} fieldName="duration" label={t('Duration')} />;

    case ReplayColumn.OS:
      return <SortableHeader sort={sort} fieldName="os.name" label={t('OS')} />;

    case ReplayColumn.REPLAY:
      return <SortableHeader sort={sort} fieldName="started_at" label={t('Replay')} />;

    case ReplayColumn.MOST_ERRONEOUS_REPLAYS:
      return <SortableHeader label={t('Most erroneous replays')} />;

    case ReplayColumn.MOST_RAGE_CLICKS:
      return (
        <SortableHeader
          label={t('Most rage clicks')}
          tooltip={tct(
            'A rage click is 5 or more clicks on a dead element, which exhibits no page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
            {
              minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
              link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
            }
          )}
        />
      );

    case ReplayColumn.MOST_DEAD_CLICKS:
      return (
        <SortableHeader
          label={t('Most dead clicks')}
          tooltip={tct(
            'A dead click is a user click that does not result in any page activity after 7 seconds. Requires SDK version >= [minSDK]. [link:Learn more.]',
            {
              minSDK: MIN_DEAD_RAGE_CLICK_SDK.minVersion,
              link: <ExternalLink href="https://docs.sentry.io/platforms/javascript/" />,
            }
          )}
        />
      );

    case ReplayColumn.SLOWEST_TRANSACTION:
      return (
        <SortableHeader
          label={t('Slowest Transaction')}
          tooltip={t(
            'Slowest single instance of this transaction captured by this session.'
          )}
        />
      );

    default:
      return null;
  }
}

export default HeaderCell;
