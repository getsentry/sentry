import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {renderTableBody} from 'sentry/views/codecov/tokens/repoTokenTable/tableBody';
import {renderTableHeader} from 'sentry/views/codecov/tokens/repoTokenTable/tableHeader';

type RepoTokenTableResponse = {
  createdAt: string;
  name: string;
  token: string;
};

export type Row = Pick<RepoTokenTableResponse, 'name' | 'token' | 'createdAt'>;
export type Column = GridColumnHeader<'name' | 'token' | 'createdAt' | 'regenerateToken'>;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
};

const COLUMNS_ORDER: Column[] = [
  {key: 'name', name: t('Repository Name'), width: 350},
  {key: 'token', name: t('Token'), width: 275},
  {key: 'createdAt', name: t('Created Date'), width: COL_WIDTH_UNDEFINED},
  {key: 'regenerateToken', name: '', width: 100},
];

export const SORTABLE_FIELDS = ['name', 'createdAt'] as const;

export const DEFAULT_SORT: ValidSort = {
  field: 'createdAt',
  kind: 'desc',
};

export function isAValidSort(sort: Sort): sort is ValidSort {
  return (SORTABLE_FIELDS as unknown as string[]).includes(sort.field);
}

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
        renderHeadCell: column =>
          renderTableHeader({
            column,
            sort,
          }),
        renderBodyCell: (column, row) =>
          renderTableBody({
            column,
            row,
          }),
      }}
    />
  );
}
