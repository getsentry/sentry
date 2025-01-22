import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {PanelTable, PanelTableHeader} from 'sentry/components/panels/panelTable';
import TextOverflow from 'sentry/components/textOverflow';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types/metrics';
import {isNotQueryOnly, unescapeMetricsFormula} from 'sentry/utils/metrics';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {formatMRIField, MRIToField} from 'sentry/utils/metrics/mri';
import {
  isMetricFormula,
  type MetricsQueryApiQueryParams,
  type MetricsQueryApiRequestQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import type {Order} from 'sentry/views/dashboards/metrics/types';
import {LoadingScreen} from 'sentry/views/insights/common/components/chart';

interface MetricTableContainerProps {
  isLoading: boolean;
  metricQueries: MetricsQueryApiQueryParams[];
  timeseriesData?: MetricsQueryApiResponse;
}

export function MetricTableContainer({
  timeseriesData,
  metricQueries,
  isLoading,
}: MetricTableContainerProps) {
  const tableData = useMemo(() => {
    return timeseriesData
      ? getTableData(timeseriesData, metricQueries)
      : {headers: [], rows: []};
  }, [timeseriesData, metricQueries]);

  return <MetricTable isLoading={isLoading} data={tableData} borderless />;
}

interface MetricTableProps {
  data: TableData;
  isLoading: boolean;
  borderless?: boolean;
  onOrderChange?: ({id, order}: {id: number; order: Order}) => void;
}

export function MetricTable({
  isLoading,
  data,
  borderless,
  onOrderChange,
}: MetricTableProps) {
  const handleCellClick = useCallback(
    (column: any) => {
      if (!onOrderChange) {
        return;
      }
      const {order} = column;
      const newOrder = order === 'desc' ? 'asc' : 'desc';
      onOrderChange({...column, order: newOrder});
    },
    [onOrderChange]
  );

  function renderRow(row: Row, index: number) {
    return data.headers.map((column, columnIndex) => {
      const key = `${index}-${columnIndex}:${column.name}`;
      const value = row[column.name]!.formattedValue ?? row[column.name]!.value;
      if (!value) {
        return (
          <TableCell type={column.type} key={key} noValue>
            {column.type === 'field' ? 'n/a' : '(none)'}
          </TableCell>
        );
      }
      return (
        <TableCell type={column.type} key={key}>
          {value}
        </TableCell>
      );
    });
  }

  if (isLoading) {
    return <LoadingScreen loading />;
  }

  return (
    <StyledPanelTable
      borderless={borderless}
      headers={data.headers.map((column, index) => {
        return (
          <HeaderCell
            key={index}
            type={column.type}
            onClick={() => handleCellClick(column)}
            disabled={column.type !== 'field' || !onOrderChange}
          >
            {column.order && (
              <IconArrow direction={column.order === 'asc' ? 'up' : 'down'} size="xs" />
            )}
            <TextOverflow>{column.label}</TextOverflow>
          </HeaderCell>
        );
      })}
      stickyHeaders
      emptyMessage={t('No results')}
    >
      {data.rows.map(renderRow)}
    </StyledPanelTable>
  );
}

const equalGroupBys = (a: Record<string, unknown>, b: Record<string, unknown>) => {
  return JSON.stringify(a) === JSON.stringify(b);
};

const getEmptyGroup = (tags: string[]) =>
  tags.reduce((acc, tag) => {
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    acc[tag] = '';
    return acc;
  }, {});

function getGroupByCombos(
  queries: MetricsQueryApiRequestQuery[],
  results: MetricsQueryApiResponse['data']
): Record<string, string>[] {
  const groupBys = Array.from(new Set(queries.flatMap(query => query.groupBy ?? [])));
  const emptyBy = getEmptyGroup(groupBys);

  const allCombos = results.flatMap(group => {
    return group.map(entry => ({...emptyBy, ...entry.by}));
  });

  const uniqueCombos = allCombos.filter(
    (combo, index, self) => index === self.findIndex(other => equalGroupBys(other, combo))
  );

  return uniqueCombos;
}

type Row = Record<string, {formattedValue?: string; value?: number}>;

interface TableData {
  headers: {
    label: string;
    name: string;
    order: Order;
    type: string;
  }[];
  rows: Row[];
}

export function getTableData(
  data: MetricsQueryApiResponse,
  expressions: MetricsQueryApiQueryParams[]
): TableData {
  const queries = expressions.filter(isNotQueryOnly) as MetricsQueryApiRequestQuery[];
  // @ts-ignore TS(2339): Property 'isHidden' does not exist on type 'Metric... Remove this comment to see the full error message
  const shownExpressions = expressions.filter(e => !e.isHidden);
  const tags = [...new Set(queries.flatMap(query => query.groupBy ?? []))];

  const normalizedResults = shownExpressions.map((expression, index) => {
    const expressionResults = data.data[index]!;
    const meta = data.meta[index]!;
    const lastMetaEntry = data.meta[index]?.[meta.length - 1];
    const metaUnit =
      (lastMetaEntry && 'unit' in lastMetaEntry && lastMetaEntry.unit) || 'none';
    const normalizedGroupResults = expressionResults.map(group => {
      return {
        by: {...getEmptyGroup(tags), ...group.by},
        totals: group.totals,
        formattedValue: formatMetricUsingUnit(group.totals, metaUnit),
      };
    });

    return {name: expression.name, results: normalizedGroupResults};
  }, {});

  const groupByCombos = getGroupByCombos(queries, data.data);

  const rows: Row[] = groupByCombos.map(combo => {
    const row = Object.entries(combo).reduce((acc, [key, value]) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[key] = {value};
      return acc;
    }, {});

    normalizedResults.forEach(({name, results}) => {
      const entry = results.find(e => equalGroupBys(e.by, combo));
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      row[name] = {value: entry?.totals, formattedValue: entry?.formattedValue};
    });

    return row;
  });

  const headers = [
    ...tags.map(tagName => ({
      name: tagName,
      label: tagName,
      type: 'tag',
      order: undefined,
    })),
    ...shownExpressions.map(query => ({
      name: query.name,
      // @ts-ignore TS(2339): Property 'id' does not exist on type 'MetricsQuery... Remove this comment to see the full error message
      id: query.id,
      label:
        // TODO(metrics): consider consolidating with getMetricQueryName (different types)
        query.alias ??
        (isMetricFormula(query)
          ? unescapeMetricsFormula(query.formula)
          : formatMRIField(MRIToField(query.mri, query.aggregation))),
      type: 'field',
      order: query.orderBy,
    })),
  ];

  const tableData = {
    headers,
    rows: sortRows(rows, headers),
  };

  return tableData;
}

function sortRows(rows: Row[], headers: TableData['headers']) {
  const orderedByColumn = headers.find(header => !!header.order);
  if (!orderedByColumn) {
    return rows;
  }
  const sorted = rows.sort((a, b) => {
    const aValue = a[orderedByColumn.name]?.value ?? '';
    const bValue = b[orderedByColumn.name]?.value ?? '';
    if (orderedByColumn.order === 'asc') {
      return aValue > bValue ? 1 : -1;
    }

    return aValue < bValue ? 1 : -1;
  });
  return sorted;
}

const Cell = styled('div')<{type?: string}>`
  display: flex;
  flex-direction: row;
  justify-content: ${p => (p.type === 'field' ? ' flex-end' : ' flex-start')};
`;

const StyledPanelTable = styled(PanelTable)<{borderless?: boolean}>`
  position: relative;
  display: grid;
  overflow: auto;
  margin: 0;
  margin-top: ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;

  ${p =>
    p.borderless &&
    `border-radius: 0 0 ${p.theme.borderRadius} ${p.theme.borderRadius};
    border-left: 0;
    border-right: 0;
    border-bottom: 0;`}

  ${PanelTableHeader} {
    height: min-content;
  }
`;

const HeaderCell = styled('div')<{disabled: boolean; type?: string}>`
  padding: 0 ${space(0.5)};
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: ${space(0.5)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
  justify-content: ${p => (p.type === 'field' ? ' flex-end' : ' flex-start')};
`;

export const TableCell = styled(Cell)<{noValue?: boolean}>`
  padding: ${space(1)} ${space(3)};
  ${p => p.noValue && `color: ${p.theme.gray300};`}
`;
