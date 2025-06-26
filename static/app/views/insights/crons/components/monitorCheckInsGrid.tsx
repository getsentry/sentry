import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {CheckIn, CheckInCellKey} from 'sentry/views/insights/crons/types';

import {CheckInCell} from './checkInCell';

type Props = {
  checkIns: CheckIn[];
  project: Project;
  hasMultiEnv?: boolean;
  isLoading?: boolean;
};

export function MonitorCheckInsGrid({checkIns, isLoading, project, hasMultiEnv}: Props) {
  const envColumn: Array<GridColumnOrder<CheckInCellKey>> = hasMultiEnv
    ? [{key: 'environment', width: 120, name: t('Environment')}]
    : [];

  return (
    <GridEditable<CheckIn, CheckInCellKey>
      isLoading={isLoading}
      emptyMessage={t('No check-ins have been recorded for this time period.')}
      data={checkIns}
      columnOrder={[
        {key: 'status', width: 120, name: t('Status')},
        {key: 'started', width: 200, name: t('Started')},
        {key: 'completed', width: 240, name: t('Completed')},
        {key: 'duration', width: 150, name: t('Duration')},
        {key: 'issues', width: 160, name: t('Issues')},
        ...envColumn,
        {key: 'expectedAt', width: 240, name: t('Expected At')},
      ]}
      columnSortBy={[]}
      grid={{
        renderBodyCell: (column, checkIn) => (
          <CheckInCell cellKey={column.key} project={project} checkIn={checkIn} />
        ),
      }}
    />
  );
}
