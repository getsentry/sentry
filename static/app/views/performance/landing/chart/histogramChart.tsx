import {Fragment} from 'react';
import {withTheme} from '@emotion/react';
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
import {computeBuckets, formatHistogramData} from 'app/utils/performance/histogram/utils';
import {Theme} from 'app/utils/theme';

import {DoubleHeaderContainer} from '../../styles';
import {getFieldOrBackup} from '../display/utils';

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
  didReceiveMultiAxis?: (axisCounts: Record<string, number>) => void;
  backupField?: string;
  usingBackupAxis: boolean;
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
    didReceiveMultiAxis,
    backupField,
    usingBackupAxis,
  } = props;

  const _backupField = backupField ? [backupField] : [];

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
        fields={[field, ..._backupField]}
        dataFilter="exclude_outliers"
        didReceiveMultiAxis={didReceiveMultiAxis}
      >
        {results => {
          const _field = usingBackupAxis ? getFieldOrBackup(field, backupField) : field;
          const loading = results.isLoading;
          const errored = results.error !== null;
          const chartData = results.histograms?.[_field];

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
                paramStart={`${_field}:>=`}
                paramEnd={`${_field}:<=`}
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
            </Fragment>
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
