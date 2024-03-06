import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import PanelTable, {PanelTableHeader} from 'sentry/components/panels/panelTable';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import {formatMRIField, MRIToField, parseMRI} from 'sentry/utils/metrics/mri';
import {
  isMetricFormula,
  type MetricsQueryApiQueryParams,
  type MetricsQueryApiRequestQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import type {Order} from 'sentry/views/dashboards/metrics/types';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';

interface MetricTableContainerProps {
  isLoading: boolean;
  metricQueries: MetricsQueryApiRequestQuery[];
  timeseriesData?: MetricsQueryApiResponse;
}

export function MetricTableContainer({
  timeseriesData,
  metricQueries,
  isLoading,
}: MetricTableContainerProps) {
  const tableData = useMemo(() => {
    return timeseriesData ? getTableData(timeseriesData, metricQueries) : undefined;
  }, [timeseriesData, metricQueries]);

  if (!tableData) {
    return null;
  }

  return (
    <Fragment>
      <LoadingScreen loading={isLoading} />
      <MetricTable isLoading={isLoading} data={tableData} borderless />
    </Fragment>
  );
}

interface MetricTableProps {
  data: TableData;
  isLoading: boolean;
  borderless?: boolean;
  onOrderChange?: ({name, order}: {name: string; order: string}) => void;
}

export function MetricTable({
  isLoading,
  data,
  borderless,
  onOrderChange,
}: MetricTableProps) {
  const handleCellClick = useCallback(
    column => {
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
      const value = row[column.name].formattedValue ?? row[column.name].value;
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

  return (
    <StyledPanelTable
      borderless={borderless}
      headers={data.headers.map((column, index) => {
        const header = formatMRIField(column.label);
        return (
          <HeaderCell
            key={index}
            type={column.type}
            onClick={() => handleCellClick(column)}
            disabled={column.type !== 'field'}
          >
            <TextOverflow>
              {column.order && (
                <IconArrow direction={column.order === 'asc' ? 'up' : 'down'} size="xs" />
              )}
              <span>{header}</span>
            </TextOverflow>
          </HeaderCell>
        );
      })}
      stickyHeaders
      isLoading={isLoading}
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
  queries: MetricsQueryApiQueryParams[]
): TableData {
  const filteredQueries = queries.filter(
    query => !isMetricFormula(query)
  ) as MetricsQueryApiRequestQuery[];

  const tags = [...new Set(filteredQueries.flatMap(query => query.groupBy ?? []))];

  const normalizedResults = filteredQueries.map((query, index) => {
    const queryResults = data.data[index];
    const meta = data.meta[index];
    const lastMetaEntry = data.meta[index]?.[meta.length - 1];
    const metaUnit =
      (lastMetaEntry && 'unit' in lastMetaEntry && lastMetaEntry.unit) || 'none';
    const normalizedGroupResults = queryResults.map(group => {
      return {
        by: {...getEmptyGroup(tags), ...group.by},
        totals: group.totals,
        formattedValue: formatMetricsUsingUnitAndOp(
          group.totals,
          metaUnit ?? parseMRI(query.mri)?.unit!,
          query.op
        ),
      };
    });

    return {name: query.name, results: normalizedGroupResults};
  }, {});

  const groupByCombos = getGroupByCombos(filteredQueries, data.data);

  const rows: Row[] = groupByCombos.map(combo => {
    const row = Object.entries(combo).reduce((acc, [key, value]) => {
      acc[key] = {value};
      return acc;
    }, {});

    normalizedResults.forEach(({name, results}) => {
      const entry = results.find(e => equalGroupBys(e.by, combo));
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
    ...filteredQueries.map(query => ({
      name: query.name,
      label: MRIToField(query.mri, query.op),
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
  text-align: ${p => (p.type === 'field' ? 'right' : 'left')};
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

const HeaderCell = styled(Cell)<{disabled: boolean}>`
  display: flex;
  gap: ${space(0.5)};
  padding: 0 ${space(0.5)};
  cursor: ${p => (p.disabled ? 'default' : 'pointer')};
`;

export const TableCell = styled(Cell)<{noValue?: boolean}>`
  padding: ${space(1)} ${space(3)};
  ${p => p.noValue && `color: ${p.theme.gray300};`}
`;
