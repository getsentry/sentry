import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import SortableHeader from 'sentry/views/replays/replayTable/sortableHeader';
import {type ReplayColumns} from 'sentry/views/replays/replayTable/types';

type Props = {
  column: keyof typeof ReplayColumns;
  sort?: Sort;
};

function HeaderCell({column, sort}: Props) {
  switch (column) {
    case 'session':
      return <SortableHeader label={t('Session')} />;

    case 'projectId':
      return <SortableHeader sort={sort} fieldName="projectId" label={t('Project')} />;

    case 'slowestTransaction':
      return (
        <SortableHeader
          label={t('Slowest Transaction')}
          tooltip={t(
            'Slowest single instance of this transaction captured by this session.'
          )}
        />
      );

    case 'startedAt':
      return <SortableHeader sort={sort} fieldName="startedAt" label={t('Start Time')} />;

    case 'duration':
      return <SortableHeader sort={sort} fieldName="duration" label={t('Duration')} />;

    case 'countErrors':
      return <SortableHeader sort={sort} fieldName="countErrors" label={t('Errors')} />;

    case 'activity':
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

    default:
      return null;
  }
}

export default HeaderCell;
