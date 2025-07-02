import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useEAPSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';
import {convertSeriesToTimeseries} from 'sentry/views/insights/common/utils/convertSeriesToTimeseries';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/platform/laravel/utils';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {ModalChartContainer} from 'sentry/views/insights/pages/platform/shared/styles';
import {Toolbar} from 'sentry/views/insights/pages/platform/shared/toolbar';

interface TrafficWidgetProps extends LoadableChartWidgetProps {
  referrer: string;
  title: string;
  trafficSeriesName: string;
  query?: string;
}

export function BaseTrafficWidget({
  title,
  trafficSeriesName,
  query,
  referrer,
  ...props
}: TrafficWidgetProps) {
  const organization = useOrganization();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const pageFilterChartParams = usePageFilterChartParams({
    granularity: 'spans-low',
    pageFilters: props.pageFilters,
  });

  const theme = useTheme();

  const {data, isLoading, error} = useEAPSeries(
    {
      ...pageFilterChartParams,
      search: query,
      yAxis: ['trace_status_rate(internal_error)', 'count(span.duration)'],
    },
    referrer,
    props.pageFilters
  );

  const aliases = {
    'count(span.duration)': trafficSeriesName,
    'trace_status_rate(internal_error)': t('Error Rate'),
  };

  const plottables = useMemo(() => {
    return [
      new Bars(convertSeriesToTimeseries(data['count(span.duration)']), {
        alias: trafficSeriesName,
        color: theme.gray200,
      }),
      new Line(convertSeriesToTimeseries(data['trace_status_rate(internal_error)']), {
        alias: t('Error Rate'),
        color: theme.error,
      }),
    ];
  }, [data, theme.error, theme.gray200, trafficSeriesName]);

  const isEmpty = useMemo(
    () =>
      plottables.every(
        plottable =>
          plottable.isEmpty || plottable.timeSeries.values.every(point => !point.value)
      ),
    [plottables]
  );

  const visualization = (
    <WidgetVisualizationStates
      isLoading={isLoading}
      error={error}
      isEmpty={isEmpty}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: props.id,
        plottables,
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  return (
    <Widget
      Title={<Widget.WidgetTitle title={title} />}
      Visualization={visualization}
      Actions={
        organization.features.includes('visibility-explore-view') &&
        !isEmpty && (
          <Toolbar
            aliases={aliases}
            showCreateAlert
            referrer={referrer}
            exploreParams={{
              mode: Mode.AGGREGATE,
              visualize: [
                {
                  chartType: ChartType.BAR,
                  yAxes: ['count(span.duration)'],
                },
              ],
              groupBy: ['trace.status'],
              sort: '-count(span.duration)',
              query,
              interval: pageFilterChartParams.interval,
            }}
            loaderSource={props.loaderSource}
            onOpenFullScreen={() => {
              openInsightChartModal({
                title,
                children: <ModalChartContainer>{visualization}</ModalChartContainer>,
              });
            }}
          />
        )
      }
    />
  );
}
