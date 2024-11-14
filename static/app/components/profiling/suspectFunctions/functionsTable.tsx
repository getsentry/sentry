import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import type {GridColumnOrder} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {ArrayLinks} from 'sentry/components/profiling/arrayLinks';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import type {EventsResults, Sort} from 'sentry/utils/profiling/hooks/types';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getProfileTargetId} from 'sentry/views/profiling/utils';

interface FunctionsTableProps {
  analyticsPageSource: 'performance_transaction' | 'profiling_transaction';
  error: string | null;
  functions: EventsResults<TableColumnKey>['data'];
  isLoading: boolean;
  project: Project | undefined;
  sort: Sort<any>;
}

export function FunctionsTable(props: FunctionsTableProps) {
  const location = useLocation();
  const organization = useOrganization();

  const functions: TableDataRow[] = useMemo(() => {
    const project = props.project;
    if (!project) {
      return [];
    }

    return props.functions.map(func => {
      const examples = func['all_examples()'];

      return {
        ...func,
        'all_examples()': examples.map(example => {
          return {
            value: getShortEventId(getProfileTargetId(example)),
            onClick: () =>
              trackAnalytics('profiling_views.go_to_flamegraph', {
                organization,
                source: `${props.analyticsPageSource}.suspect_functions_table`,
              }),
            target: generateProfileRouteFromProfileReference({
              orgSlug: organization.slug,
              projectSlug: project.slug,
              reference: example,
              // specify the frame to focus, the flamegraph will switch
              // to the appropriate thread when these are specified
              frameName: func.function as string,
              framePackage: func.package as string,
            }),
          };
        }),
      };
    });
  }, [organization, props.project, props.functions, props.analyticsPageSource]);

  const generateSortLink = useCallback(
    (column: TableColumnKey) => {
      if (!SORTABLE_COLUMNS.has(column)) {
        return () => undefined;
      }

      const direction =
        props.sort.key !== column ? 'desc' : props.sort.order === 'desc' ? 'asc' : 'desc';

      return () => ({
        ...location,
        query: {
          ...location.query,
          functionsSort: `${direction === 'desc' ? '-' : ''}${column}`,
        },
      });
    },
    [location, props.sort]
  );

  return (
    <GridEditable
      isLoading={props.isLoading}
      error={props.error}
      data={functions}
      columnOrder={COLUMN_ORDER.map(key => COLUMNS[key])}
      columnSortBy={[]}
      grid={{
        renderHeadCell: renderTableHead({
          currentSort: props.sort,
          rightAlignedColumns: RIGHT_ALIGNED_COLUMNS,
          sortableColumns: SORTABLE_COLUMNS,
          generateSortLink,
        }),
        renderBodyCell: renderFunctionsTableCell,
      }}
    />
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>(['p75()', 'sum()', 'count()']);

const SORTABLE_COLUMNS = RIGHT_ALIGNED_COLUMNS;

function renderFunctionsTableCell(
  column: TableColumn,
  dataRow: TableDataRow,
  rowIndex: number,
  columnIndex: number
) {
  return (
    <ProfilingFunctionsTableCell
      column={column}
      dataRow={dataRow}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
    />
  );
}

interface ProfilingFunctionsTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

function ProfilingFunctionsTableCell({
  column,
  dataRow,
}: ProfilingFunctionsTableCellProps) {
  const value = dataRow[column.key];

  switch (column.key) {
    case 'count()':
      return (
        <NumberContainer>
          <Count value={value} />
        </NumberContainer>
      );
    case 'p75()':
    case 'sum()':
      return (
        <NumberContainer>
          <PerformanceDuration nanoseconds={value} abbreviation />
        </NumberContainer>
      );
    case 'all_examples()':
      return <ArrayLinks items={value} />;
    case 'function':
    case 'package':
      const name = value || <EmptyValueContainer>{t('Unknown')}</EmptyValueContainer>;
      return <Container>{name}</Container>;
    default:
      return <Container>{value}</Container>;
  }
}

export const functionsFields = [
  'package',
  'function',
  'count()',
  'p75()',
  'sum()',
  'all_examples()',
] as const;

export type TableColumnKey = (typeof functionsFields)[number];

type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'function',
  'package',
  'count()',
  'p75()',
  'sum()',
  'all_examples()',
];

const COLUMNS: Record<TableColumnKey, TableColumn> = {
  function: {
    key: 'function',
    name: t('Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  package: {
    key: 'package',
    name: t('Package'),
    width: COL_WIDTH_UNDEFINED,
  },
  'p75()': {
    key: 'p75()',
    name: t('P75 Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  'sum()': {
    key: 'sum()',
    name: t('Total Self Time'),
    width: COL_WIDTH_UNDEFINED,
  },
  'count()': {
    key: 'count()',
    name: t('Occurrences'),
    width: COL_WIDTH_UNDEFINED,
  },
  'all_examples()': {
    key: 'all_examples()',
    name: t('Example Profiles'),
    width: COL_WIDTH_UNDEFINED,
  },
};
