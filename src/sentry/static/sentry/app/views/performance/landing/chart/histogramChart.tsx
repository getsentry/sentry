import React from 'react';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';
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
import {computeBuckets, formatHistogramData} from 'app/utils/performance/histogram/utils';
import {Theme} from 'app/utils/theme';

import {DoubleHeaderContainer} from '../../styles';

const NUM_BUCKETS = 50;
const PRECISION = 0;

type Props = {
  theme: Theme;
  location: Location;
  organization: Organization;
  eventView: EventView;
  field: string;
  title: string;
  titleTooltip: string;
  onFilterChange: (minValue: number, maxValue: number) => void;
};

export function HistogramChart(props: Props) {
  const {
    theme,
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
        fields={[field]}
        dataFilter="exclude_outliers"
      >
        {results => {
          const loading = results.isLoading;
          const errored = results.error !== null;
          const chartData = results.histograms?.[field];

          if (errored) {
            return (
              <ErrorPanel height="250px">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }

          if (!chartData) {
            return null;
          }

          const series = {
            seriesName: t('Count'),
            data: formatHistogramData(chartData, {type: 'duration'}),
          };
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
                        <TransparentLoadingMask visible={loading} />
                        {getDynamicText({
                          value: (
                            <BarChart
                              height={250}
                              series={allSeries}
                              xAxis={xAxis}
                              yAxis={yAxis}
                              grid={{
                                left: space(3),
                                right: space(3),
                                top: space(3),
                                bottom: loading ? space(4) : space(1.5),
                              }}
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
            </React.Fragment>
          );
        }}
      </HistogramQuery>
    </div>
  );
}

const BarChartContainer = styled('div')`
  padding-top: ${space(1)};
  position: relative;
`;

const MaskContainer = styled('div')`
  position: relative;
`;

export default withTheme(HistogramChart);
