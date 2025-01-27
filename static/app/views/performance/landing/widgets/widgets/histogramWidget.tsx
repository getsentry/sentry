import {useMemo} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import HistogramQuery from 'sentry/utils/performance/histogram/histogramQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {Chart as HistogramChart} from 'sentry/views/performance/landing/chart/histogramChart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformHistogramQuery} from '../transforms/transformHistogramQuery';
import type {
  GenericPerformanceWidgetProps,
  PerformanceWidgetProps,
  WidgetDataResult,
} from '../types';
import {getMEPQueryParams, QUERY_LIMIT_PARAM} from '../utils';

type AreaDataType = {
  chart: WidgetDataResult & ReturnType<typeof transformHistogramQuery>;
};

export function HistogramWidget(props: PerformanceWidgetProps) {
  const location = useLocation();
  const mepSetting = useMEPSettingContext();
  const {ContainerActions, InteractiveTitle} = props;
  const globalSelection = props.eventView.getPageFilters();

  const Queries = useMemo((): GenericPerformanceWidgetProps<AreaDataType>['Queries'] => {
    return {
      chart: {
        fields: props.fields,
        component: provided => (
          <HistogramQuery
            limit={QUERY_LIMIT_PARAM}
            {...(provided as any)}
            eventView={provided.eventView}
            location={location}
            numBuckets={20}
            dataFilter="exclude_outliers"
            queryExtras={getMEPQueryParams(mepSetting)}
          />
        ),
        transform: transformHistogramQuery,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.chartSetting, mepSetting.memoizationKey, location]);

  const onFilterChange = () => {};

  return (
    <GenericPerformanceWidget<AreaDataType>
      {...props}
      location={location}
      Subtitle={() => (
        <Subtitle>
          {globalSelection.datetime.period
            ? t('In the last %s ', globalSelection.datetime.period)
            : t('In the last period')}
        </Subtitle>
      )}
      HeaderActions={provided =>
        ContainerActions && <ContainerActions {...provided.widgetData.chart} />
      }
      InteractiveTitle={
        InteractiveTitle
          ? provided => <InteractiveTitle {...provided.widgetData.chart} />
          : null
      }
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
              field={props.fields[0]!}
              chartData={provided.widgetData.chart?.data?.[props.fields[0]!]!}
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
