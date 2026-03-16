import type {GridColumnOrder} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
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
    <GridEditable<CheckIn, GridColumnOrder<CheckInCellKey>>
      isLoading={isLoading}
      emptyMessage={t('No check-ins have been recorded for this time period.')}
      fit="max-content"
      data={checkIns}
      columnOrder={[
        {key: 'status', width: 120, name: t('Status')},
        {key: 'checkInId', width: COL_WIDTH_UNDEFINED, name: t('Check-In ID')},
        {key: 'started', width: COL_WIDTH_UNDEFINED, name: t('Started')},
        {key: 'completed', width: COL_WIDTH_UNDEFINED, name: t('Completed')},
        {key: 'duration', width: COL_WIDTH_UNDEFINED, name: t('Duration')},
        {key: 'issues', width: COL_WIDTH_UNDEFINED, name: t('Issues')},
        ...envColumn,
        {key: 'expectedAt', width: COL_WIDTH_UNDEFINED, name: t('Expected At')},
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
