import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {renderTableBody} from 'sentry/views/prevent/tokens/repoTokenTable/tableBody';
import {renderTableHeader} from 'sentry/views/prevent/tokens/repoTokenTable/tableHeader';

type RepoTokenTableResponse = {
  name: string;
  token: string;
};

export type Row = RepoTokenTableResponse;
export type Column = GridColumnHeader<'name' | 'token' | 'regenerateToken'>;

type ValidField = (typeof SORTABLE_FIELDS)[number];

export function isAValidSort(sort?: Sort): sort is ValidSort {
  if (!sort) {
    return false;
  }

  return SORTABLE_FIELDS.includes(sort.field as ValidField);
}

export type ValidSort = Sort & {
  field: ValidField;
};

const COLUMNS_ORDER: Column[] = [
  {key: 'name', name: t('Repository Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'token', name: t('Token'), width: 360},
  {key: 'regenerateToken', name: '', width: 100},
];

export const SORTABLE_FIELDS = ['name'] as const;

interface Props {
  response: {
    data: Row[];
    isLoading: boolean;
    error?: Error | null;
  };
  sort?: ValidSort; // undefined when no visible column is sorted
}

export default function RepoTokenTable({response, sort}: Props) {
  const {data, isLoading} = response;

  return (
    <GridEditable
      aria-label={t('Repository Tokens Table')}
      isLoading={isLoading}
      error={response.error}
      data={data}
      columnOrder={COLUMNS_ORDER}
      columnSortBy={
        sort
          ? [
              {
                key: sort.field,
                order: sort.kind,
              },
            ]
          : []
      }
      grid={{
        renderHeadCell: column =>
          renderTableHeader({
            column: column as Column,
            sort,
          }),
        renderBodyCell: (column, row) =>
          renderTableBody({
            column: column as Column,
            row,
          }),
      }}
    />
  );
}
