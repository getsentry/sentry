import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  // GridColumnOrder,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {renderHeadCell} from 'sentry/views/codecov/tests/testAnalyticsTable/headerCell';
import {renderTableBody} from 'sentry/views/codecov/tests/testAnalyticsTable/tableBody';

type TestAnalyticsTableResponse = {
  averageDurationMs: number;
  commitsFailed: number;
  flakeRate: number;
  isBrokenTest: boolean;
  lastRun: string;
  testName: string;
};

// type row
export type Row = Pick<
  TestAnalyticsTableResponse,
  | 'testName'
  | 'averageDurationMs'
  | 'flakeRate'
  | 'commitsFailed'
  | 'lastRun'
  | 'isBrokenTest'
>;

export type Column = GridColumnHeader<
  'testName' | 'averageDurationMs' | 'flakeRate' | 'commitsFailed' | 'lastRun'
>;

const COLUMNS_ORDER: Column[] = [
  {key: 'testName', name: t('Test Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'averageDurationMs', name: t('Avg. Duration'), width: COL_WIDTH_UNDEFINED},
  {key: 'flakeRate', name: t('Flake Rate'), width: COL_WIDTH_UNDEFINED},
  {key: 'commitsFailed', name: t('Commits Failed'), width: COL_WIDTH_UNDEFINED},
  {key: 'lastRun', name: t('Last Run'), width: COL_WIDTH_UNDEFINED},
];

export const RIGHT_ALIGNED_FIELDS = new Set([
  'averageDurationMs',
  'flakeRate',
  'commitsFailed',
]);

// Sortable fields
export const SORTABLE_FIELDS = [
  'testName',
  'averageDurationMs',
  'flakeRate',
  'commitsFailed',
  'lastRun',
] as const;

export type ValidSort = Sort & {
  field: (typeof SORTABLE_FIELDS)[number];
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

export default function TestAnalyticsTable({response, sort}: Props) {
  const {data, isLoading} = response;
  const location = useLocation();

  return (
    <GridEditable
      aria-label={t('Test Analytics')}
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
          renderHeadCell({
            column,
            sort,
            location,
          }),
        renderBodyCell: (column, row) => renderTableBody({column, row}),
      }}
    />
  );
}
