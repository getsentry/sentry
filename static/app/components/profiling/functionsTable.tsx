import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {ArrayLinks} from 'sentry/components/profiling/arrayLinks';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {SuspectFunction} from 'sentry/types/profiling/core';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface FunctionsTableProps {
  error: string | null;
  functions: SuspectFunction[];
  isLoading: boolean;
  project: Project;
  sort: string;
}

function FunctionsTable(props: FunctionsTableProps) {
  const location = useLocation();
  const organization = useOrganization();

  const sort = useMemo(() => {
    let column = props.sort;
    let order: 'asc' | 'desc' = 'asc' as const;

    if (props.sort.startsWith('-')) {
      column = props.sort.substring(1);
      order = 'desc' as const;
    }

    if (!SORTABLE_COLUMNS.has(column as any)) {
      column = 'p99';
    }

    return {
      key: column as TableColumnKey,
      order,
    };
  }, [props.sort]);

  const functions: TableDataRow[] = useMemo(() => {
    return props.functions.map(func => {
      const {worst, examples, ...rest} = func;

      const allExamples = examples.filter(example => example !== worst);
      allExamples.unshift(worst);

      return {
        ...rest,
        examples: allExamples.map(example => {
          const profileId = example.replaceAll('-', '');
          return {
            value: getShortEventId(profileId),
            target: generateProfileFlamechartRouteWithQuery({
              orgSlug: organization.slug,
              projectSlug: props.project.slug,
              profileId,
              query: {
                // specify the frame to focus, the flamegraph will switch
                // to the appropriate thread when these are specified
                frameName: func.name,
                framePackage: func.package,
              },
            }),
          };
        }),
      };
    });
  }, [organization.slug, props.project.slug, props.functions]);

  const generateSortLink = useCallback(
    (column: TableColumnKey) => {
      if (!SORTABLE_COLUMNS.has(column)) {
        return () => undefined;
      }

      const direction =
        sort.key !== column ? 'desc' : sort.order === 'desc' ? 'asc' : 'desc';

      return () => ({
        ...location,
        query: {
          ...location.query,
          functionsSort: `${direction === 'desc' ? '-' : ''}${column}`,
        },
      });
    },
    [location, sort]
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
          currentSort: sort,
          rightAlignedColumns: RIGHT_ALIGNED_COLUMNS,
          sortableColumns: SORTABLE_COLUMNS,
          generateSortLink,
        }),
        renderBodyCell: renderFunctionsTableCell,
      }}
      location={location}
    />
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>(['p75', 'p99', 'count']);
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
    case 'count':
      return (
        <NumberContainer>
          <Count value={value} />
        </NumberContainer>
      );
    case 'p75':
    case 'p99':
      return (
        <NumberContainer>
          <PerformanceDuration nanoseconds={value} abbreviation />
        </NumberContainer>
      );
    case 'examples':
      return <ArrayLinks items={value} />;
    case 'name':
    case 'package':
      const name = value || <EmptyValueContainer>{t('Unknown')}</EmptyValueContainer>;
      return <Container>{name}</Container>;
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey = keyof Omit<SuspectFunction, 'fingerprint' | 'worst'>;

type TableDataRow = Record<TableColumnKey, any>;

type TableColumn = GridColumnOrder<TableColumnKey>;

const COLUMN_ORDER: TableColumnKey[] = [
  'name',
  'package',
  'count',
  'p75',
  'p99',
  'examples',
];

const COLUMNS: Record<TableColumnKey, TableColumn> = {
  name: {
    key: 'name',
    name: t('Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  package: {
    key: 'package',
    name: t('Package'),
    width: COL_WIDTH_UNDEFINED,
  },
  path: {
    key: 'path',
    name: t('Path'),
    width: COL_WIDTH_UNDEFINED,
  },
  p75: {
    key: 'p75',
    name: t('P75 Total Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  p99: {
    key: 'p99',
    name: t('P99 Total Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  count: {
    key: 'count',
    name: t('Total Occurrences'),
    width: COL_WIDTH_UNDEFINED,
  },
  examples: {
    key: 'examples',
    name: t('Example Profiles'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {FunctionsTable};
