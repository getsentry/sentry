import {Fragment, useMemo, type ReactNode} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import Duration from 'sentry/components/duration';
import Placeholder from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {RateUnit} from 'sentry/utils/discover/fields';
import {formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {unreachable} from 'sentry/utils/unreachable';

export interface EventRegressionTableRow {
  group: string;
  operation: string;
  percentageChange: number;
  description?: string;
  durationAfter?: number;
  durationBefore?: number;
  throughputAfter?: number;
  throughputBefore?: number;
}

type MetricColumnKey =
  | 'durationBefore'
  | 'durationAfter'
  | 'throughputBefore'
  | 'throughputAfter'
  | 'percentageChange';
type TableColumnKey = 'description' | 'operation' | MetricColumnKey;
type TableColumn = {
  key: TableColumnKey;
  name: ReactNode;
};

interface EventRegressionTableProps {
  causeType: 'duration' | 'throughput';
  data: EventRegressionTableRow[];
  isLoading: boolean;
  onDescriptionLink: (row: EventRegressionTableRow) => LocationDescriptor | undefined;
  error?: Error | null;
}

export function EventRegressionTable({
  causeType,
  data,
  error,
  isLoading,
  onDescriptionLink,
}: EventRegressionTableProps) {
  const columns = useMemo<TableColumn[]>(() => {
    const [beforeKey, afterKey]: [TableColumnKey, TableColumnKey] =
      causeType === 'throughput'
        ? ['throughputBefore', 'throughputAfter']
        : ['durationBefore', 'durationAfter'];

    return [
      {key: 'operation', name: t('Operation')},
      {key: 'description', name: t('Description')},
      {key: beforeKey, name: t('Baseline')},
      {key: afterKey, name: t('Regressed')},
      {key: 'percentageChange', name: t('Change')},
    ];
  }, [causeType]);

  return (
    <RegressionTable>
      <SimpleTable.Header>
        {columns.map(column => {
          return (
            <SimpleTable.HeaderCell
              key={column.key}
              style={
                RIGHT_ALIGNED_COLUMNS.has(column.key) ? RIGHT_ALIGNED_STYLE : undefined
              }
            >
              {column.name}
            </SimpleTable.HeaderCell>
          );
        })}
      </SimpleTable.Header>

      {isLoading ? (
        <SkeletonRows columns={columns} />
      ) : error ? (
        <SimpleTable.Empty>
          <Flex align="center" gap="sm">
            <IconWarning />
            {error?.message ?? t('There was an error loading data.')}
          </Flex>
        </SimpleTable.Empty>
      ) : data.length === 0 ? (
        <SimpleTable.Empty>{t('No results found for your query')}</SimpleTable.Empty>
      ) : (
        data.map(row => (
          <SimpleTable.Row key={row.group}>
            {columns.map(column => (
              <SimpleTable.RowCell
                key={column.key}
                style={
                  RIGHT_ALIGNED_COLUMNS.has(column.key) ? RIGHT_ALIGNED_STYLE : undefined
                }
              >
                {renderCell(column.key, row, onDescriptionLink)}
              </SimpleTable.RowCell>
            ))}
          </SimpleTable.Row>
        ))
      )}
    </RegressionTable>
  );
}

function renderCell(
  columnKey: TableColumnKey,
  row: EventRegressionTableRow,
  onDescriptionLink: (row: EventRegressionTableRow) => LocationDescriptor | undefined
) {
  switch (columnKey) {
    case 'throughputBefore':
    case 'throughputAfter': {
      const rawValue = row[columnKey];
      const renderedValue = defined(rawValue)
        ? formatRate(rawValue, RateUnit.PER_MINUTE)
        : null;
      return <CellText numeric>{renderedValue}</CellText>;
    }
    case 'durationBefore':
    case 'durationAfter': {
      const rawValue = row[columnKey];
      const renderedValue = defined(rawValue) ? (
        <Duration seconds={rawValue} fixedDigits={2} abbreviation />
      ) : null;
      return <CellText numeric>{renderedValue}</CellText>;
    }
    case 'percentageChange': {
      const change = row.percentageChange;
      if (change === Infinity) {
        return <CellText numeric />;
      }
      return (
        <CellText numeric>
          <Text as="span" variant={changeTextVariant(change)}>
            {change > 0 ? '+' : ''}
            {formatPercentage(change)}
          </Text>
        </CellText>
      );
    }
    case 'description': {
      const value = defined(row.description) ? row.description : t('(unnamed span)');
      const link = onDescriptionLink(row);
      if (defined(link)) {
        return (
          <CellText>
            <Link to={link}>{value}</Link>
          </CellText>
        );
      }
      return <CellText>{value}</CellText>;
    }
    case 'operation':
      return <CellText>{row.operation}</CellText>;
    default:
      return unreachable(columnKey);
  }
}

function SkeletonRows({columns}: {columns: TableColumn[]}) {
  return (
    <Fragment>
      {Array.from({length: 4}).map((_, rowIndex) => (
        <SimpleTable.Row key={rowIndex}>
          {columns.map(column => {
            const isRightAligned = RIGHT_ALIGNED_COLUMNS.has(column.key);
            return (
              <SimpleTable.RowCell
                key={`${column.key}-skeleton-${rowIndex}`}
                style={isRightAligned ? RIGHT_ALIGNED_STYLE : undefined}
              >
                <Placeholder height="16px" width={isRightAligned ? '80px' : '100%'} />
              </SimpleTable.RowCell>
            );
          })}
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>([
  'durationBefore',
  'durationAfter',
  'throughputBefore',
  'throughputAfter',
  'percentageChange',
]);

const RIGHT_ALIGNED_STYLE = {
  justifyContent: 'flex-end',
  textAlign: 'right',
} as const;

const RegressionTable = styled(SimpleTable)`
  grid-template-columns: 100px minmax(100px, 2fr) 150px 150px 100px;
`;

function changeTextVariant(change: number): 'danger' | 'primary' | 'success' {
  if (change > 0) {
    return 'danger';
  }
  if (change < 0) {
    return 'success';
  }
  return 'primary';
}

function CellText({children, numeric}: {children?: ReactNode; numeric?: boolean}) {
  return (
    <Container width="100%" overflow="hidden">
      <Text as="div" align={numeric ? 'right' : undefined} ellipsis tabular={numeric}>
        {children}
      </Text>
    </Container>
  );
}
