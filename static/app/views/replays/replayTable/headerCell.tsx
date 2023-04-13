import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/replays/replayTable/sortableHeader';
import {ReplayColumns} from 'sentry/views/replays/replayTable/types';

type Props = {
  column: keyof typeof ReplayColumns;
  sort?: Sort;
};

function HeaderCell({column, sort}: Props) {
  switch (column) {
    case ReplayColumns.activity:
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

    case ReplayColumns.browser:
      return <SortableHeader sort={sort} fieldName="browser.name" label={t('Browser')} />;

    case ReplayColumns.countErrors:
      return <SortableHeader sort={sort} fieldName="count_errors" label={t('Errors')} />;

    case ReplayColumns.duration:
      return <SortableHeader sort={sort} fieldName="duration" label={t('Duration')} />;

    case ReplayColumns.os:
      return <SortableHeader sort={sort} fieldName="os.name" label={t('OS')} />;

    case ReplayColumns.replay:
      return <SortableHeader sort={sort} fieldName="started_at" label={t('Replay')} />;

    case ReplayColumns.replay_slim:
      return <SortableHeader sort={sort} fieldName="started_at" label={t('Replay')} />;

    case ReplayColumns.slowestTransaction:
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
