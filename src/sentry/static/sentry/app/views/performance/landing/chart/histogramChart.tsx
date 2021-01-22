import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import BarChart from 'app/components/charts/barChart';
import BarChartZoom from 'app/components/charts/barChartZoom';
import LoadingPanel from 'app/components/charts/loadingPanel';
import QuestionTooltip from 'app/components/questionTooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import EventView from 'app/utils/discover/eventView';
import {getDuration} from 'app/utils/formatters';
import theme from 'app/utils/theme';

import {DoubleHeaderContainer, HeaderTitleLegend} from '../../styles';
import HistogramQuery from '../../transactionVitals/histogramQuery';

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
};

function getBucketWidth(chartData) {
  // We can assume that all buckets are of equal width, use the first two
  // buckets to get the width. The value of each histogram function indicates
  // the beginning of the bucket.
  return chartData.length >= 2 ? chartData[1].bin - chartData[0].bin : 0;
}

function computeBuckets(chartData) {
  const bucketWidth = getBucketWidth(chartData);

  return chartData.map(item => {
    const bucket = item.bin;
    return {
      start: bucket,
      end: bucket + bucketWidth,
    };
  });
}

function formatDuration(duration: number) {
  if (duration <= 1000) {
    return getDuration(duration / 1000, 2, true);
  }

  return getDuration(duration / 1000, 3, true);
}

function getSeries(chartData) {
  const bucketWidth = getBucketWidth(chartData);

  const seriesData = chartData.map(item => {
    const bucket = item.bin;
    const midPoint = bucketWidth > 1 ? Math.ceil(bucket + bucketWidth / 2) : bucket;
    const name = formatDuration(midPoint);

    const value = item.count;

    return {
      value,
      name,
    };
  });

  return {
    seriesName: t('Count'),
    data: seriesData,
  };
}

export function HistogramChart(props: Props) {
  const {
    location,
    onFilterChange,
    organization,
    eventView,
    field,
    title,
    titleTooltip,
  } = props;

  const xAxis = {
    type: 'category' as const,
    truncate: true,
    boundaryGap: false,
    axisTick: {
      alignWithLabel: true,
    },
  };

  return (
    <HistogramContainer>
      <HistogramQuery
        location={location}
        orgSlug={organization.slug}
        eventView={eventView}
        numBuckets={NUM_BUCKETS}
        precision={PRECISION}
        fields={[field]}
        dataFilter="exclude_outliers"
      >
        {results => {
          const loading = results.isLoading;
          const errored = results.error !== null;
          const chartData = results.histograms?.[field];

          if (loading) {
            return (
              <LoadingPanel height="250px" data-test-id="histogram-request-loading" />
            );
          }

          if (!chartData) {
            return null;
          }

          const series = getSeries(chartData);
          const allSeries: Series[] = [];

          if (!loading && !errored) {
            allSeries.push(series);
          }

          const values = series.data.map(point => point.value);
          const max = values.length ? Math.max(...values) : undefined;

          const yAxis = {
            type: 'value' as const,
            max,
            axisLabel: {
              color: theme.chartLabel,
            },
          };

          return (
            <React.Fragment>
              <DoubleHeaderContainer>
                <HeaderTitleLegend>
                  {title}
                  <QuestionTooltip position="top" size="sm" title={titleTooltip} />
                </HeaderTitleLegend>
              </DoubleHeaderContainer>
              <BarChartZoom
                minZoomWidth={10 ** -PRECISION * NUM_BUCKETS}
                location={location}
                paramStart={`${field}:>=`}
                paramEnd={`${field}:<=`}
                xAxisIndex={[0]}
                buckets={computeBuckets(chartData)}
                onHistoryPush={onFilterChange}
              >
                {zoomRenderProps => (
                  <BarChartContainer>
                    <BarChart
                      height={250}
                      series={allSeries}
                      xAxis={xAxis}
                      yAxis={yAxis}
                      grid={{
                        left: space(3),
                        right: space(3),
                        top: space(3),
                        bottom: space(1.5),
                      }}
                      stacked
                      {...zoomRenderProps}
                    />
                  </BarChartContainer>
                )}
              </BarChartZoom>
            </React.Fragment>
          );
        }}
      </HistogramQuery>
    </HistogramContainer>
  );
}

const HistogramContainer = styled('div')``;

const BarChartContainer = styled('div')`
  padding-top: ${space(1)};
`;

export default HistogramChart;
