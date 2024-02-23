import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import ErrorPanel from 'sentry/components/charts/errorPanel';
import EmptyMessage from 'sentry/components/emptyMessage';
import PanelTable, {PanelTableHeader} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsQueryApiResponse, PageFilters} from 'sentry/types';
import {getMetricsSeriesName} from 'sentry/utils/metrics';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {
  getMetricValueNormalizer,
  getNormalizedMetricUnit,
} from 'sentry/utils/metrics/normalizeMetricValue';
import {
  MetricDisplayType,
  type MetricQueryWidgetParams,
} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiQueryParams} from 'sentry/utils/metrics/useMetricsQuery';
import {isMetricFormula, useMetricsQuery} from 'sentry/utils/metrics/useMetricsQuery';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';

import {convertToMetricWidget} from '../../../../utils/metrics/dashboard';
import type {Widget} from '../../types';

type MetricWidgetChartContainerProps = {
  selection: PageFilters;
  widget: Widget;
  chartHeight?: number;
  metricWidgetQueries?: MetricQueryWidgetParams[];
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
};

export function MetricWidgetTableContainer({
  selection,
  renderErrorMessage,
  metricWidgetQueries,
  widget,
}: MetricWidgetChartContainerProps) {
  // TODO: Remove this and the widget prop once this component is no longer used in widgetViewerModal
  const metricQueries = metricWidgetQueries || convertToMetricWidget(widget);

  const displayType = metricQueries[0].displayType;

  const {
    data: timeseriesData,
    isLoading,
    isError,
    error,
  } = useMetricsQuery(metricQueries, selection, {
    intervalLadder: displayType === MetricDisplayType.BAR ? 'bar' : 'dashboard',
  });

  const tableSeries = useMemo(() => {
    return timeseriesData ? getTableSeries(timeseriesData, metricQueries) : [];
  }, [timeseriesData, metricQueries]);

  if (isError) {
    const errorMessage =
      error?.responseJSON?.detail?.toString() || t('Error while fetching metrics data');
    return (
      <Fragment>
        {renderErrorMessage?.(errorMessage)}
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      </Fragment>
    );
  }

  if (timeseriesData?.data.length === 0) {
    return (
      <EmptyMessage
        icon={<IconSearch size="xxl" />}
        title={t('No results')}
        description={t('No results found for the given query')}
      />
    );
  }

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
      // data={data.map(renderRow)}
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
  border-radius: 0;
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
