import GridEditable, {type GridColumnHeader} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {renderTableBody} from 'sentry/views/codecov/tokens/repoTokenTable/tableBody';
import {renderTableHeader} from 'sentry/views/codecov/tokens/repoTokenTable/tableHeader';

type RepoTokenTableResponse = {
  name: string;
  token: string;
};

export type Row = Pick<RepoTokenTableResponse, 'name' | 'token'>;
export type Column = GridColumnHeader<'name' | 'token' | 'regenerateToken'>;

type ValidField = (typeof SORTABLE_FIELDS)[number];

export function isAValidSort(sort: Sort): sort is ValidSort {
  return SORTABLE_FIELDS.includes(sort.field as ValidField);
}

export type ValidSort = Sort & {
  field: ValidField;
};

const COLUMNS_ORDER: Column[] = [
  {key: 'name', name: t('Repository Name'), width: 400},
  {key: 'token', name: t('Token'), width: 350},
  {key: 'regenerateToken', name: '', width: 100},
];

export const SORTABLE_FIELDS = ['name'] as const;

export const DEFAULT_SORT: ValidSort = {
  field: 'name',
  kind: 'desc',
};

interface Props {
  response: {
    data: Row[];
    isLoading: boolean;
    error?: Error | null;
  };
  sort: ValidSort;
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
      columnSortBy={[
        {
          key: sort.field,
          order: sort.kind,
        },
      ]}
      grid={{
        renderHeadCell: (column: Column) =>
          renderTableHeader({
            column,
            sort,
          }),
        renderBodyCell: (column: Column, row: Row) =>
          renderTableBody({
            column,
            row,
          }),
      }}
    />
  );
}
