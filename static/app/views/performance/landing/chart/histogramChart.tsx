import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import type {BarChartProps} from 'sentry/components/charts/barChart';
import {BarChart} from 'sentry/components/charts/barChart';
import BarChartZoom from 'sentry/components/charts/barChartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import type {HistogramData} from 'sentry/utils/performance/histogram/types';
import {
  computeBuckets,
  formatHistogramData,
} from 'sentry/utils/performance/histogram/utils';

import {DoubleHeaderContainer} from '../../styles';

import {getFieldOrBackup} from './utils';

const NUM_BUCKETS = 50;
const PRECISION = 0;

type Props = {
  eventView: EventView;
  field: string;
  location: Location;
  onFilterChange: (minValue: number, maxValue: number) => void;
  organization: Organization;
  title: string;
  titleTooltip: string;
  usingBackupAxis: boolean;
  backupField?: string;
  didReceiveMultiAxis?: (axisCounts: Record<string, number>) => void;
};

export function HistogramChart(props: Props) {
  const {
    location,
    onFilterChange,
    organization,
    eventView,
    field,
    title,
    titleTooltip,
    didReceiveMultiAxis,
    backupField,
    usingBackupAxis,
  } = props;

  const _backupField = backupField ? [backupField] : [];

  return (
    <div>
      <DoubleHeaderContainer>
        <HeaderTitleLegend>
          {title}
          <QuestionTooltip position="top" size="sm" title={titleTooltip} />
        </HeaderTitleLegend>
      </DoubleHeaderContainer>
      <HistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        precision={PRECISION}
        fields={[field, ..._backupField]}
        dataFilter="exclude_outliers"
        didReceiveMultiAxis={didReceiveMultiAxis}
      >
        {results => {
          const _field = usingBackupAxis ? getFieldOrBackup(field, backupField) : field;
          const isLoading = results.isLoading;
          const isErrored = results.error !== null;
          const chartData = results.histograms?.[_field];

          if (isErrored) {
            return (
              <ErrorPanel height="250px">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }

          if (!chartData) {
            return null;
          }

          return (
            <Chart
              isLoading={isLoading}
              isErrored={isErrored}
              chartData={chartData}
              location={location}
              onFilterChange={onFilterChange}
              field={_field}
            />
          );
        }}
      </HistogramQuery>
    </div>
  );
}

type ChartProps = {
  field: string;
  isErrored: boolean;
  isLoading: boolean;
  location: Location;
  onFilterChange: Props['onFilterChange'];
  chartData?: HistogramData;
  colors?: string[];
  disableChartPadding?: boolean;
  disableXAxis?: boolean;
  disableZoom?: boolean;
  grid?: BarChartProps['grid'];
  height?: number;
};

export function Chart(props: ChartProps) {
  const {
    isLoading,
    isErrored,
    chartData,
    location,
    field,
    onFilterChange,
    height,
    grid,
    disableXAxis,
    disableZoom,
    disableChartPadding,
    colors,
  } = props;
  const theme = useTheme();

  if (!chartData) {
    return null;
  }

  const series = {
    seriesName: t('Count'),
    data: formatHistogramData(chartData, {type: 'duration'}),
  };

  const xAxis = {
    type: 'category' as const,
    truncate: true,
    axisTick: {
      alignWithLabel: true,
    },
  };

  const allSeries: Series[] = [];

  if (!isLoading && !isErrored) {
    allSeries.push(series);
  }

  const yAxis = {
    type: 'value' as const,
    axisLabel: {
      color: theme.chartLabel,
      formatter: (value: number | string) => formatAbbreviatedNumber(value),
    },
  };

  return (
    <Fragment>
      <BarChartZoom
        minZoomWidth={10 ** -PRECISION * NUM_BUCKETS}
        location={location}
        paramStart={`${field}:>=`}
        paramEnd={`${field}:<=`}
        xAxisIndex={[0]}
        buckets={computeBuckets(chartData)}
        onHistoryPush={onFilterChange}
      >
        {zoomRenderProps => {
          return (
            <BarChartContainer hasPadding={!disableChartPadding}>
              <MaskContainer>
                <TransparentLoadingMask visible={isLoading} />
                {getDynamicText({
                  value: (
                    <BarChart
                      height={height ?? 250}
                      series={allSeries}
                      xAxis={disableXAxis ? {show: false} : xAxis}
                      yAxis={yAxis}
                      colors={colors}
                      grid={
                        grid ?? {
                          left: space(3),
                          right: space(3),
                          top: space(3),
                          bottom: isLoading ? space(4) : space(1.5),
                        }
                      }
                      stacked
                      {...(disableZoom ? {} : zoomRenderProps)}
                    />
                  ),
                  fixed: <Placeholder height="250px" testId="skeleton-ui" />,
                })}
              </MaskContainer>
            </BarChartContainer>
          );
        }}
      </BarChartZoom>
    </Fragment>
  );
}

const BarChartContainer = styled('div')<{hasPadding?: boolean}>`
  padding-top: ${p => (p.hasPadding ? space(1) : 0)};
  position: relative;
`;

const MaskContainer = styled('div')`
  position: relative;
`;

export default HistogramChart;
