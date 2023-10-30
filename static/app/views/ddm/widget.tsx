import {useCallback, useEffect, useState} from 'react';
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
import {PageFilters} from 'sentry/types';
import {
  defaultMetricDisplayType,
  getUnitFromMRI,
  MetricDisplayType,
  MetricsData,
  MetricsQuery,
  updateQuery,
  useMetricsDataZoom,
} from 'sentry/utils/metrics';
import {decodeList} from 'sentry/utils/queryString';
import theme from 'sentry/utils/theme';
import useRouter from 'sentry/utils/useRouter';
import {MetricChart} from 'sentry/views/ddm/chart';
import {QueryBuilder} from 'sentry/views/ddm/queryBuilder';
import {SummaryTable} from 'sentry/views/ddm/summaryTable';

import {DEFAULT_SORT_STATE, MIN_WIDGET_WIDTH} from './constants';

type SortState = {
  name: 'name' | 'avg' | 'min' | 'max' | 'sum';
  order: 'asc' | 'desc';
};

const emptyWidget = {
  mri: '',
  op: undefined,
  query: '',
  groupBy: [],
  sort: DEFAULT_SORT_STATE,
};

export type MetricWidgetDisplayConfig = {
  displayType: MetricDisplayType;
  onChange: (data: Partial<MetricWidgetProps>) => void;
  position: number;
  sort: SortState;
  focusedSeries?: string;
  powerUserMode?: boolean;
  showSummaryTable?: boolean;
};

export type MetricWidgetProps = Pick<MetricsQuery, 'mri' | 'op' | 'query' | 'groupBy'> &
  MetricWidgetDisplayConfig;

export function useMetricWidgets() {
  const router = useRouter();

  const currentWidgets = JSON.parse(
    router.location.query.widgets ?? JSON.stringify([emptyWidget])
  );

  const widgets: MetricWidgetProps[] = currentWidgets.map(
    (widget: MetricWidgetProps, i) => {
      return {
        mri: widget.mri,
        op: widget.op,
        query: widget.query,
        groupBy: decodeList(widget.groupBy),
        displayType: widget.displayType ?? defaultMetricDisplayType,
        focusedSeries: widget.focusedSeries,
        showSummaryTable: widget.showSummaryTable ?? true, // temporary default
        position: widget.position ?? i,
        powerUserMode: widget.powerUserMode,
        sort: widget.sort ?? DEFAULT_SORT_STATE,
      };
    }
  );

  const onChange = (position: number, data: Partial<MetricWidgetProps>) => {
    currentWidgets[position] = {...currentWidgets[position], ...data};

    updateQuery(router, {
      widgets: JSON.stringify(currentWidgets),
    });
  };

  const addWidget = () => {
    currentWidgets.push({...emptyWidget, position: currentWidgets.length});

    updateQuery(router, {
      widgets: JSON.stringify(currentWidgets),
    });
  };

  return {
    widgets,
    onChange,
    addWidget,
  };
}

// TODO(ddm): reuse from types/metrics.tsx
type Group = {
  by: Record<string, unknown>;
  series: Record<string, number[]>;
  totals: Record<string, number>;
};

export function MetricWidget({
  widget,
  datetime,
  projects,
  environments,
}: {
  datetime: PageFilters['datetime'];
  environments: PageFilters['environments'];
  projects: PageFilters['projects'];
  widget: MetricWidgetProps;
}) {
  return (
    <MetricWidgetPanel key={widget.position}>
      <PanelBody>
        <QueryBuilder
          metricsQuery={{
            mri: widget.mri,
            query: widget.query,
            op: widget.op,
            groupBy: widget.groupBy,
          }}
          projects={projects}
          displayType={widget.displayType}
          onChange={widget.onChange}
          powerUserMode={widget.powerUserMode}
        />
        {widget.mri ? (
          <MetricWidgetBody
            datetime={datetime}
            projects={projects}
            environments={environments}
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

function MetricWidgetBody({
  onChange,
  displayType,
  focusedSeries,
  sort,
  ...metricsQuery
}: MetricWidgetProps & PageFilters) {
  const {mri, op, query, groupBy, projects, environments, datetime} = metricsQuery;

  const {data, isLoading, isError, error, onZoom} = useMetricsDataZoom({
    mri,
    op,
    query,
    groupBy,
    projects,
    environments,
    datetime,
  });

  const [dataToBeRendered, setDataToBeRendered] = useState<MetricsData | undefined>(
    undefined
  );

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

function getChartSeries(data: MetricsData, {focusedSeries, groupBy, hoveredLegend}) {
  const unit = getUnitFromMRI(Object.keys(data.groups[0]?.series ?? {})[0]); // this assumes that all series have the same unit

  const series = data.groups.map(g => {
    return {
      values: Object.values(g.series)[0],
      name: getSeriesName(g, data.groups.length === 1, groupBy),
      transaction: g.by.transaction,
      release: g.by.release,
    };
  });

  const colors = theme.charts.getColorPalette(series.length);

  return series
    .sort((a, b) => a.name?.localeCompare(b.name))
    .map((item, i) => ({
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

function getSeriesName(
  group: Group,
  isOnlyGroup = false,
  groupBy: MetricsQuery['groupBy']
) {
  if (isOnlyGroup && !groupBy?.length) {
    return Object.keys(group.series)?.[0] ?? '(none)';
  }

  return Object.entries(group.by)
    .map(([key, value]) => `${key}:${String(value).length ? value : t('none')}`)
    .join(', ');
}

function normalizeChartTimeParams(data: MetricsData) {
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

const MetricWidgetPanel = styled(Panel)`
  padding-bottom: 0;
  margin-bottom: 0;
  min-width: ${MIN_WIDGET_WIDTH}px;
`;

const StyledMetricWidgetBody = styled('div')`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  justify-content: center;
`;
