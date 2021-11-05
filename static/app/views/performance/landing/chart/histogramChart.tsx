import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import BarChart from 'app/components/charts/barChart';
import BarChartZoom from 'app/components/charts/barChartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import {HeaderTitleLegend} from 'app/components/charts/styles';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons/iconWarning';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import EventView from 'app/utils/discover/eventView';
import getDynamicText from 'app/utils/getDynamicText';
import HistogramQuery from 'app/utils/performance/histogram/histogramQuery';
import {HistogramData} from 'app/utils/performance/histogram/types';
import {computeBuckets, formatHistogramData} from 'app/utils/performance/histogram/utils';

import {DoubleHeaderContainer} from '../../styles';
import {getFieldOrBackup} from '../display/utils';

const NUM_BUCKETS = 50;
const PRECISION = 0;

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
  field: string;
  title: string;
  titleTooltip: string;
  onFilterChange: (minValue: number, maxValue: number) => void;
  didReceiveMultiAxis?: (axisCounts: Record<string, number>) => void;
  backupField?: string;
  usingBackupAxis: boolean;
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
  chartData?: HistogramData;
  isLoading: boolean;
  isErrored: boolean;
  location: Location;
  onFilterChange: Props['onFilterChange'];
  field: string;
  height?: number;
  grid?: BarChart['props']['grid'];
  disableXAxis?: boolean;
  colors?: string[];
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
    colors,
  } = props;
  if (!chartData) {
    return null;
  }
  const theme = useTheme();

  const series = {
    seriesName: t('Count'),
    data: formatHistogramData(chartData, {type: 'duration'}),
  };

  const xAxis = {
    type: 'category' as const,
    truncate: true,
    boundaryGap: false,
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
            <BarChartContainer>
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
                      {...zoomRenderProps}
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

const BarChartContainer = styled('div')`
  padding-top: ${space(1)};
  position: relative;
`;

const MaskContainer = styled('div')`
  position: relative;
`;

export default HistogramChart;
