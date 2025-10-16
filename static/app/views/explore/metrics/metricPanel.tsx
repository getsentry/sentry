import {useMemo, useRef} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import SplitPanel from 'sentry/components/splitPanel';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDimensions} from 'sentry/utils/useDimensions';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface MetricPanelProps {
  queryIndex: number;
  traceMetric: TraceMetric;
}

const MIN_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 400;

export function MetricPanel({traceMetric, queryIndex}: MetricPanelProps) {
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();
  const searchQuery = useQueryParamsSearch();
  const sortBys = useQueryParamsAggregateSortBys();

  const search = useMemo(() => {
    const currentSearch = new MutableSearch(`metric.name:${traceMetric.name}`);
    if (!searchQuery.isEmpty()) {
      currentSearch.addStringFilter(searchQuery.formatString());
    }
    return currentSearch;
  }, [traceMetric.name, searchQuery]);

  const timeseriesResult = useSortedTimeSeries(
    {
      search,
      yAxis: [visualize.yAxis],
      interval,
      fields: [...groupBys, visualize.yAxis],
      enabled: Boolean(traceMetric.name),
      topEvents,
      orderby: sortBys.map(formatSort),
    },
    'api.explore.metrics-stats',
    DiscoverDatasets.TRACEMETRICS
  );

  const hasSize = width > 0;

  return (
    <Panel>
      <PanelBody>
        <div ref={measureRef}>
          {hasSize ? (
            <SplitPanel
              availableSize={width}
              left={{
                content: (
                  <MetricsGraph
                    timeseriesResult={timeseriesResult}
                    queryIndex={queryIndex}
                  />
                ),
                default: width * 0.65,
                min: MIN_LEFT_WIDTH,
                max: width - MIN_RIGHT_WIDTH,
              }}
              right={<MetricInfoTabs traceMetric={traceMetric} />}
            />
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
