import type {LocationDescriptor} from 'history';

import type {TableColumnConfig} from '@sentry/scraps/table';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

export type TagSort = 'date' | 'count';

const COLUMNS: TableColumnConfig[] = [
  {key: 'value', width: '1fr'},
  {key: 'lastSeen', width: 'min-content', visible: {xs: true}},
  {key: 'count', width: 'min-content'},
  {key: 'share', width: 'min-content', visible: {sm: true}},
  {key: 'actions', width: 'min-content'},
];

export function TagDetailsTable({
  children,
  sort,
  getSortLocation,
}: {
  children: React.ReactNode;
  getSortLocation: (sort: TagSort) => LocationDescriptor;
  sort: TagSort;
}) {
  return (
    <SimpleTable
      aria-label={t('Tag values')}
      columns={COLUMNS}
      density="compressed"
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Value')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell
            sort={sort === 'date' ? 'desc' : undefined}
            to={getSortLocation('date')}
          >
            {t('Last Seen')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell
            align="right"
            sort={sort === 'count' ? 'desc' : undefined}
            to={getSortLocation('count')}
          >
            {t('Count')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell align="right">{t('Share')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell aria-label={t('Actions')} />
        </SimpleTable.HeaderRow>
      }
    >
      {children}
    </SimpleTable>
  );
}
