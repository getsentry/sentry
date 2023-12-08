import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import colorFn from 'color';
import type {LineSeriesOption} from 'echarts';
import moment from 'moment';

import Alert from 'sentry/components/alert';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MetricsApiResponse, PageFilters} from 'sentry/types';
import {
  getSeriesName,
  MetricDisplayType,
  MetricWidgetQueryParams,
} from 'sentry/utils/metrics';
import {getMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsDataZoom} from 'sentry/utils/metrics/useMetricsData';
import theme from 'sentry/utils/theme';
import {MetricChart} from 'sentry/views/ddm/chart';
import {MetricWidgetContextMenu} from 'sentry/views/ddm/contextMenu';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';

import {MIN_WIDGET_WIDTH} from './constants';

export const MetricWidget = memo(
  ({
    widget,
    datetime,
    projects,
    environments,
    index,
    isSelected,
    onSelect,
    onChange,
  }: {
    datetime: PageFilters['datetime'];
    environments: PageFilters['environments'];
    index: number;
    isSelected: boolean;
    onChange: (index: number, data: Partial<MetricWidgetQueryParams>) => void;
    onSelect: (index: number) => void;
    projects: PageFilters['projects'];
    widget: MetricWidgetQueryParams;
  }) => {
    const handleChange = useCallback(
      (data: Partial<MetricWidgetQueryParams>) => {
        onChange(index, data);
      },
      [index, onChange]
    );

    const metricsQuery = useMemo(
      () => ({
        mri: widget.mri,
        query: widget.query,
        op: widget.op,
        groupBy: widget.groupBy,
        projects,
        datetime,
        environments,
      }),
      [widget, projects, datetime, environments]
    );

    return (
      <MetricWidgetPanel isSelected={isSelected} onClick={() => onSelect(index)}>
        <PanelBody>
          <MetricWidgetHeader>
            <QueryBuilder
              metricsQuery={metricsQuery}
              projects={projects}
              displayType={widget.displayType}
              onChange={handleChange}
              powerUserMode={widget.powerUserMode}
            />
            <MetricWidgetContextMenu
              metricsQuery={metricsQuery}
              displayType={widget.displayType}
            />
          </MetricWidgetHeader>
          {widget.mri ? (
            <MetricWidgetBody
              datetime={datetime}
              projects={projects}
              environments={environments}
              onChange={handleChange}
              {...widget}
            />
          ) : (
            <StyledMetricWidgetBody>
              <EmptyMessage
                icon={<IconSearch size="xxl" />}
                title={t('Nothing to show!')}
                description={t('Choose a metric to display data.')}
              />
            </StyledMetricWidgetBody>
          )}
        </PanelBody>
      </MetricWidgetPanel>
    );
  }
);

const MetricWidgetHeader = styled('div')`
  display: flex;

  justify-content: space-between;
  margin-bottom: ${space(1)};
`;

interface MetricWidgetProps extends MetricWidgetQueryParams {
  onChange: (data: Partial<MetricWidgetQueryParams>) => void;
}

const MetricWidgetBody = memo(
  ({
    onChange,
    displayType,
    focusedSeries,
    sort,
    ...metricsQuery
  }: MetricWidgetProps & PageFilters) => {
    const {mri, op, query, groupBy, projects, environments, datetime} = metricsQuery;

    const {data, isLoading, isError, error, onZoom} = useMetricsDataZoom(
      {
        mri,
        op,
        query,
        groupBy,
        projects,
        environments,
        datetime,
      },
      {fidelity: displayType === MetricDisplayType.BAR ? 'low' : 'high'}
    );

    const [dataToBeRendered, setDataToBeRendered] = useState<
      MetricsApiResponse | undefined
    >(undefined);

    const [hoveredLegend, setHoveredLegend] = useState('');

    useEffect(() => {
      if (data) {
        setDataToBeRendered(data);
      }
    }, [data]);

    const toggleSeriesVisibility = useCallback(
      (seriesName: string) => {
        setHoveredLegend('');
        onChange({
          focusedSeries: focusedSeries === seriesName ? undefined : seriesName,
        });
      },
      [focusedSeries, onChange]
    );

    if (!dataToBeRendered || isError) {
      return (
        <StyledMetricWidgetBody>
          {isLoading && <LoadingIndicator />}
          {isError && (
            <Alert type="error">
              {error?.responseJSON?.detail || t('Error while fetching metrics data')}
            </Alert>
          )}
        </StyledMetricWidgetBody>
      );
    }

    const chartSeries = getChartSeries(dataToBeRendered, {
      focusedSeries,
      hoveredLegend,
      groupBy: metricsQuery.groupBy,
      displayType,
    });

    return (
      <StyledMetricWidgetBody>
        <TransparentLoadingMask visible={isLoading} />
        <MetricChart
          series={chartSeries}
          displayType={displayType}
          operation={metricsQuery.op}
          projects={metricsQuery.projects}
          environments={metricsQuery.environments}
          {...normalizeChartTimeParams(dataToBeRendered)}
          onZoom={onZoom}
        />
        {metricsQuery.showSummaryTable && (
          <SummaryTable
            series={chartSeries}
            onSortChange={newSort => {
              onChange({sort: newSort});
            }}
            sort={sort}
            operation={metricsQuery.op}
            onRowClick={toggleSeriesVisibility}
            setHoveredLegend={focusedSeries ? undefined : setHoveredLegend}
          />
        )}
      </StyledMetricWidgetBody>
    );
  }
);

export function getChartSeries(
  data: MetricsApiResponse,
  {focusedSeries, groupBy, hoveredLegend, displayType}
) {
  // this assumes that all series have the same unit
  const mri = getMRI(Object.keys(data.groups[0]?.series ?? {})[0]);
  const parsed = parseMRI(mri);
  const unit = parsed?.unit ?? '';

  const series = data.groups.map(g => {
    return {
      values: Object.values(g.series)[0],
      name: getSeriesName(g, data.groups.length === 1, groupBy),
      transaction: g.by.transaction,
      release: g.by.release,
    };
  });

  const colors = getChartColorPalette(displayType, series.length);

  return sortSeries(series, displayType).map((item, i) => ({
    seriesName: item.name,
    unit,
    color: colorFn(colors[i])
      .alpha(hoveredLegend && hoveredLegend !== item.name ? 0.1 : 1)
      .string(),
    hidden: focusedSeries && focusedSeries !== item.name,
    data: item.values.map((value, index) => ({
      name: moment(data.intervals[index]).valueOf(),
      value,
    })),
    transaction: item.transaction as string | undefined,
    release: item.release as string | undefined,
    emphasis: {
      focus: 'series',
    } as LineSeriesOption['emphasis'],
  })) as Series[];
}

function sortSeries(
  series: {
    name: string;
    release: string;
    transaction: string;
    values: (number | null)[];
  }[],
  displayType: MetricDisplayType
) {
  const sorted = series
    // we need to sort the series by their values so that the colors in area chart do not overlap
    // for now we are only sorting by the first value, but we might need to sort by the sum of all values
    .sort((a, b) => {
      return Number(a.values?.[0]) > Number(b.values?.[0]) ? -1 : 1;
    });

  if (displayType === MetricDisplayType.BAR) {
    return sorted.toReversed();
  }

  return sorted;
}

function getChartColorPalette(displayType: MetricDisplayType, length: number) {
  const palette = theme.charts.getColorPalette(length - 2);

  if (displayType === MetricDisplayType.BAR) {
    return palette;
  }

  return palette.toReversed();
}

function normalizeChartTimeParams(data: MetricsApiResponse) {
  const {
    start,
    end,
    utc: utcString,
    statsPeriod,
  } = normalizeDateTimeParams(data, {
    allowEmptyPeriod: true,
    allowAbsoluteDatetime: true,
    allowAbsolutePageDatetime: true,
  });

  const utc = utcString === 'true';

  if (start && end) {
    return utc
      ? {
          start: moment.utc(start).format(),
          end: moment.utc(end).format(),
          utc,
        }
      : {
          start: moment(start).utc().format(),
          end: moment(end).utc().format(),
          utc,
        };
  }

  return {
    period: statsPeriod ?? '90d',
  };
}

export type Series = {
  color: string;
  data: {name: number; value: number}[];
  seriesName: string;
  unit: string;
  hidden?: boolean;
  release?: string;
  transaction?: string;
};

const MetricWidgetPanel = styled(Panel)<{isSelected: boolean}>`
  padding-bottom: 0;
  margin-bottom: 0;
  min-width: ${MIN_WIDGET_WIDTH}px;
  position: relative;
  ${p =>
    p.isSelected &&
    // Use ::after to avoid layout shifts when the border changes from 1px to 2px
    `
  &::after {
    content: '';
    position: absolute;
    top: -1px;
    left: -1px;
    bottom: -1px;
    right: -1px;
    pointer-events: none;
    border: 2px solid ${p.theme.purple300};
    border-radius: ${p.theme.borderRadius};
  `}
`;

const StyledMetricWidgetBody = styled('div')`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
