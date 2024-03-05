import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import PanelTable, {PanelTableHeader} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
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
  data: {
    headers: {name: string; type: string}[];
    rows: any[];
  };
  isLoading: boolean;
  borderless?: boolean;
}

export function MetricTable({isLoading, data, borderless}: MetricTableProps) {
  function renderRow(row: any, index: number) {
    return data.headers.map((column, columnIndex) => {
      const key = `${index}-${columnIndex}:${column}`;
      const value = row[column.name];
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
        const header = formatMRIField(column.name);
        return (
          <HeaderCell key={index} type={column.type}>
            <Tooltip title={header}>{header}</Tooltip>
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

const equalGroupBys = (a: Record<string, any>, b: Record<string, any>) => {
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
type Row = Record<string, string | undefined>;

interface TableData {
  headers: {name: string; type: string}[];
  rows: Row[];
}

export function getTableData(
  data: MetricsQueryApiResponse,
  queries: MetricsQueryApiQueryParams[]
): TableData {
  const filteredQueries = queries.filter(
    query => !isMetricFormula(query)
  ) as MetricsQueryApiRequestQuery[];

  const fields = filteredQueries.map(query => MRIToField(query.mri, query.op));
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
        totals: formatMetricsUsingUnitAndOp(
          group.totals,
          // TODO(ogi): switch to using the meta unit when it's available
          metaUnit ?? parseMRI(query.mri)?.unit!,
          query.op
        ),
      };
    });

    const key = MRIToField(query.mri, query.op);
    return {field: key, results: normalizedGroupResults};
  }, {});

  const groupByCombos = getGroupByCombos(filteredQueries, data.data);

  const rows: Row[] = groupByCombos.map(combo => {
    const row: Row = {...combo};

    normalizedResults.forEach(({field, results}) => {
      const entry = results.find(e => equalGroupBys(e.by, combo));
      row[field] = entry?.totals;
    });

    return row;
  });

  const tableData = {
    headers: [
      ...tags.map(tagName => ({name: tagName, type: 'tag'})),
      ...fields.map(f => ({name: f, type: 'field'})),
    ],
    rows,
  };

  return tableData;
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

const HeaderCell = styled(Cell)`
  padding: 0 ${space(0.5)};
`;

export const TableCell = styled(Cell)<{noValue?: boolean}>`
  padding: ${space(1)} ${space(3)};
  ${p => p.noValue && `color: ${p.theme.gray300};`}
`;
