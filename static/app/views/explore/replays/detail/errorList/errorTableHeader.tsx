import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {useSortErrors} from 'sentry/views/explore/replays/detail/errorList/useSortErrors';

type SortConfig = ReturnType<typeof useSortErrors>['sortConfig'];

interface Props {
  handleSort: ReturnType<typeof useSortErrors>['handleSort'];
  sortConfig: SortConfig;
}

const COLUMNS: Array<{
  field: SortConfig['by'];
  label: string;
  width: string;
  align?: 'right';
}> = [
  {field: 'id', label: t('Event ID'), width: '112px'},
  {field: 'title', label: t('Title'), width: 'minmax(200px, 1fr)'},
  {field: 'project', label: t('Issue'), width: '180px'},
  {field: 'level', label: t('Level'), width: '96px'},
  {field: 'timestamp', label: t('Timestamp'), width: '128px', align: 'right'},
];

export const ERROR_TABLE_COLUMNS = COLUMNS.map(({field, width}) => ({
  key: field,
  width,
}));

export function ErrorTableHeader({handleSort, sortConfig}: Props) {
  return (
    <SimpleTable.Head sticky>
      <SimpleTable.HeaderRow>
        {COLUMNS.map(({align, field, label}) => (
          <SimpleTable.HeaderCell
            key={field}
            align={align}
            handleSortClick={() => handleSort(field)}
            sort={sortConfig.by === field ? (sortConfig.asc ? 'asc' : 'desc') : undefined}
          >
            {label}
          </SimpleTable.HeaderCell>
        ))}
      </SimpleTable.HeaderRow>
    </SimpleTable.Head>
  );
}
