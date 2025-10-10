import {useMemo, useRef} from 'react';

import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SplitPanel from 'sentry/components/splitPanel';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {MetricsGraph} from 'sentry/views/explore/metrics/metricGraph';
import MetricInfoTabs from 'sentry/views/explore/metrics/metricInfoTabs';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {
  useQueryParamsGroupBys,
  useQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface MetricPanelProps {
  traceMetric: TraceMetric;
}

const MIN_LEFT_WIDTH = 400;
const MIN_RIGHT_WIDTH = 400;

export function MetricPanel({traceMetric}: MetricPanelProps) {
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();
  const searchQuery = useQueryParamsSearch();

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
      fields: [...groupBys],
      enabled: Boolean(traceMetric.name),
      topEvents,
    },
    'api.explore.metrics-stats',
    DiscoverDatasets.TRACEMETRICS
  );

  const hasSize = width > 0;

  return (
    <Panel>
      <PanelHeader>
        <MetricToolbar traceMetric={traceMetric} />
      </PanelHeader>
      <PanelBody>
        <div ref={measureRef}>
          {hasSize ? (
            <SplitPanel
              availableSize={width}
              left={{
                content: <MetricsGraph timeseriesResult={timeseriesResult} />,
                default: width * 0.65,
                min: MIN_LEFT_WIDTH,
                max: width - MIN_RIGHT_WIDTH,
              }}
              right={<MetricInfoTabs />}
            />
          ) : null}
        </div>
      </PanelBody>
    </Panel>
  );
}
