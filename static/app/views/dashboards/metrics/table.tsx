import {useMemo} from 'react';
import styled from '@emotion/styled';

import PanelTable, {PanelTableHeader} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse} from 'sentry/types';
import {getMetricsSeriesName} from 'sentry/utils/metrics';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {
  getMetricValueNormalizer,
  getNormalizedMetricUnit,
} from 'sentry/utils/metrics/normalizeMetricValue';
import type {
  MetricsQueryApiQueryParams,
  MetricsQueryApiRequestQuery,
} from 'sentry/utils/metrics/useMetricsQuery';
import {isMetricFormula} from 'sentry/utils/metrics/useMetricsQuery';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';

type MetricTableContainerProps = {
  isLoading: boolean;
  metricQueries: MetricsQueryApiRequestQuery[];
  timeseriesData;
};

export function MetricTableContainer({
  timeseriesData,
  metricQueries,
  isLoading,
}: MetricTableContainerProps) {
  const tableSeries = useMemo(() => {
    return timeseriesData ? getTableSeries(timeseriesData, metricQueries) : [];
  }, [timeseriesData, metricQueries]);

  return (
    <MetricWidgetTableWrapper>
      <LoadingScreen loading={isLoading} />
      <MetricTable isLoading={isLoading} data={tableSeries} />
    </MetricWidgetTableWrapper>
  );
}

export function MetricTable({isLoading, data}) {
  function renderRow(row: any, index: number) {
    return ['name', 'value'].map((column, columnIndex) => {
      const align = column === 'value' ? 'right' : undefined;
      return (
        <TableCell align={align} key={`${index}-${columnIndex}:${column}`}>
          {row[column]}
        </TableCell>
      );
    });
  }

  return (
    <StyledPanelTable
      headers={['name', 'value'].map((column, index) => {
        const align = column === 'value' ? 'right' : undefined;
        const header = column;
        return (
          <HeadCell key={index} align={align}>
            <Tooltip title={header}>{header} </Tooltip>
          </HeadCell>
        );
      })}
      isLoading={isLoading}
      emptyMessage={t('No results')}
    >
      {data.map(renderRow)}
    </StyledPanelTable>
  );
}

export function getTableSeries(
  data: MetricsQueryApiResponse,
  queries: MetricsQueryApiQueryParams[]
) {
  const filteredQueries = queries.filter(Boolean);

  return data.data.flatMap((group, index) => {
    const query = filteredQueries[index];
    const isMultiQuery = filteredQueries.length > 1;

    let unit = '';
    let operation = '';
    if (!isMetricFormula(query)) {
      const parsed = parseMRI(query.mri);
      unit = parsed?.unit ?? '';
      operation = query.op ?? '';
    } else {
      // Treat formulas as if they were a single query with none as the unit and count as the operation
      unit = 'none';
      operation = 'count';
    }

    // We normalize metric units to make related units
    // (e.g. seconds & milliseconds) render in the correct ratio
    const normalizedUnit = getNormalizedMetricUnit(unit, operation);
    const normalizeValue = getMetricValueNormalizer(unit, operation);

    return group.map(entry => ({
      unit: normalizedUnit,
      operation: operation,
      value: formatMetricsUsingUnitAndOp(
        normalizeValue(entry.totals),
        normalizedUnit,
        operation
      ),
      name: getMetricsSeriesName(query, entry.by, isMultiQuery),
      groupBy: entry.by,
      transaction: entry.by.transaction,
      release: entry.by.release,
    }));
  });
}

const StyledPanelTable = styled(PanelTable)`
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  border-left: 0;
  border-right: 0;
  border-bottom: 0;

  margin: 0;
  ${PanelTableHeader} {
    height: min-content;
  }
`;

const MetricWidgetTableWrapper = styled('div')`
  height: 100%;
  width: 100%;
  padding: 0;
  padding-top: ${space(1.5)};
  overflow: auto;
`;

type CellProps = {
  align: string | undefined;
};

const HeadCell = styled('div')<CellProps>`
  ${(p: CellProps) => (p.align ? `text-align: ${p.align};` : '')}
  padding: 0 ${space(0.5)};
`;

export const TableCell = styled('div')`
  padding: ${space(1)} ${space(3)};
  ${(p: CellProps) => (p.align ? `text-align: ${p.align};` : '')}
`;
