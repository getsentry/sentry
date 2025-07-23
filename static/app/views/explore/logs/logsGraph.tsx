import {Fragment, useState} from 'react';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {ChartVisualization} from 'sentry/views/explore/components/chart/chartVisualization';
import {useCachedTimeseriesResults} from 'sentry/views/explore/components/chart/useCachedTimeseriesResults';
import {useLogsAggregate} from 'sentry/views/explore/contexts/logs/logsPageParams';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/views/explore/hooks/useChartInterval';
import {EXPLORE_CHART_TYPE_OPTIONS} from 'sentry/views/explore/spans/charts';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface LogsGraphProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function LogsGraph({timeseriesResult}: LogsGraphProps) {
  const aggregate = useLogsAggregate();

  const canUsePreviousResults = false;
  const cachedTimeseriesResult = useCachedTimeseriesResults({
    canUsePreviousResults,
    timeseriesResult,
    yAxis: aggregate,
  });

  const [chartType, setChartType] = useState<ChartType>(ChartType.BAR);
  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const Title = (
    <Widget.WidgetTitle title={prettifyAggregation(aggregate) ?? aggregate} />
  );

  const chartIcon =
    chartType === ChartType.LINE ? 'line' : chartType === ChartType.AREA ? 'area' : 'bar';

  const Actions = (
    <Fragment>
      <Tooltip title={t('Type of chart displayed in this visualization (ex. line)')}>
        <CompactSelect
          triggerProps={{
            icon: <IconGraph type={chartIcon} />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          value={chartType}
          menuTitle="Type"
          options={EXPLORE_CHART_TYPE_OPTIONS}
          onChange={option => setChartType(option.value)}
        />
      </Tooltip>
      <Tooltip title={t('Time interval displayed in this visualization (ex. 5m)')}>
        <CompactSelect
          value={interval}
          onChange={({value}) => setInterval(value)}
          triggerProps={{
            icon: <IconClock />,
            borderless: true,
            showChevron: false,
            size: 'xs',
          }}
          menuTitle="Interval"
          options={intervalOptions}
        />
      </Tooltip>
    </Fragment>
  );

  return (
    <Widget
      Title={Title}
      Actions={Actions}
      Visualization={
        <ChartVisualization
          chartType={chartType}
          timeseriesResult={cachedTimeseriesResult}
          yAxis={aggregate}
        />
      }
      revealActions="always"
    />
  );
}
