import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import {Chart as HistogramChart} from 'sentry/views/performance/landing/chart/histogramChart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformHistogramQuery} from '../transforms/transformHistogramQuery';
import {PerformanceWidgetProps, WidgetDataResult} from '../types';
import {getMEPQueryParams} from '../utils';

type AreaDataType = {
  chart: WidgetDataResult & ReturnType<typeof transformHistogramQuery>;
};

export function HistogramWidget(props: PerformanceWidgetProps) {
  const mepSetting = useMEPSettingContext();
  const {ContainerActions, location} = props;
  const globalSelection = props.eventView.getPageFilters();

  const Queries = useMemo(() => {
    return {
      chart: {
        fields: props.fields,
        component: provided => (
          <HistogramQuery
            {...provided}
            eventView={provided.eventView}
            location={props.location}
            numBuckets={20}
            dataFilter="exclude_outliers"
            queryExtras={getMEPQueryParams(mepSetting)}
          />
        ),
        transform: transformHistogramQuery,
      },
    };
  }, [props.chartSetting, mepSetting.memoizationKey]);

  const onFilterChange = () => {};

  return (
    <GenericPerformanceWidget<AreaDataType>
      {...props}
      Subtitle={() => (
        <Subtitle>
          {globalSelection.datetime.period
            ? t('In the last %s ', globalSelection.datetime.period)
            : t('In the last period')}
        </Subtitle>
      )}
      HeaderActions={provided => (
        <Fragment>
          <ContainerActions {...provided.widgetData.chart} />
        </Fragment>
      )}
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <HistogramChart
              {...provided}
              colors={props.chartColor ? [props.chartColor] : undefined}
              location={location}
              isLoading={false}
              isErrored={false}
              onFilterChange={onFilterChange}
              // @ts-expect-error TS(2322) FIXME: Type 'string | undefined' is not assignable to typ... Remove this comment to see the full error message
              field={props.fields[0]}
              // @ts-expect-error TS(2538) FIXME: Type 'undefined' cannot be used as an index type.
              chartData={provided.widgetData.chart?.data?.[props.fields[0]]}
              disableXAxis
              disableZoom
              disableChartPadding
            />
          ),
          height: props.chartHeight,
        },
      ]}
    />
  );
}

const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;
