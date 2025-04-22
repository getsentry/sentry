import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

export function computeSampleCountTotals(
  visualizes: Visualize[],
  data: ReturnType<typeof useSortedTimeSeries>['data'],
  isTopN: boolean
) {
  return visualizes.map(visualize => {
    const dedupedYAxes = dedupeArray(visualize.yAxes);
    const series = dedupedYAxes.flatMap(yAxis => data[yAxis]).filter(defined);
    const {sampleCount} = determineSeriesSampleCountAndIsSampled(series, isTopN);
    return sampleCount;
  });
}
