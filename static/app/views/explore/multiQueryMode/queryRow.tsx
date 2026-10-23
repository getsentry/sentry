import {Fragment} from 'react';

import {Grid} from '@sentry/scraps/layout';

import {LazyRender} from 'sentry/components/lazyRender';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useCompareAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {
  useMultiQueryTableAggregateMode,
  useMultiQueryTableSampleMode,
} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTable';
import {useMultiQueryTimeseries} from 'sentry/views/explore/multiQueryMode/hooks/useMultiQueryTimeseries';
import {
  getQueryMode,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {GroupBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/groupBy';
import {MenuSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/menu';
import {SearchBarSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/search';
import {SortBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/sortBy';
import {VisualizeSection} from 'sentry/views/explore/multiQueryMode/queryConstructors/visualize';
import {MultiQueryModeChart} from 'sentry/views/explore/multiQueryMode/queryVisualizations/chart';
import {MultiQueryTable} from 'sentry/views/explore/multiQueryMode/queryVisualizations/table';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
  totalQueryRows: number;
};

export function QueryRow({query: queryParts, index, totalQueryRows}: Props) {
  const {groupBys, query, yAxes, sortBys, caseInsensitive} = queryParts;
  const mode = getQueryMode(groupBys);

  const aggregatesTableResult = useMultiQueryTableAggregateMode({
    groupBys,
    query,
    yAxes,
    sortBys,
    enabled: mode === Mode.AGGREGATE,
    queryExtras: {
      caseInsensitive: caseInsensitive ? true : undefined,
    },
  });

  const spansTableResult = useMultiQueryTableSampleMode({
    groupBys,
    query,
    yAxes,
    sortBys,
    enabled: mode === Mode.SAMPLES,
    queryExtras: {
      caseInsensitive: caseInsensitive ? true : undefined,
    },
  });

  const {result: timeseriesResult} = useMultiQueryTimeseries({
    index,
    enabled: true,
    queryExtras: {
      caseInsensitive: caseInsensitive ? true : undefined,
    },
  });

  const [interval] = useChartInterval();

  useCompareAnalytics({
    aggregatesTableResult,
    query: queryParts,
    spansTableResult,
    timeseriesResult,
    queryType: mode === Mode.AGGREGATE ? 'aggregate' : 'samples',
    interval,
    isTopN: mode === Mode.AGGREGATE,
  });

  return (
    <Fragment>
      <Grid
        gap="md"
        marginBottom="md"
        columns={{zero: '1fr', '4xl': 'minmax(400px, 1fr) 1fr'}}
      >
        <SearchBarSection query={queryParts} index={index} />
        <Grid columns="repeat(3, minmax(0, auto)) min-content" align="end" gap="md">
          <VisualizeSection query={queryParts} index={index} />
          <GroupBySection query={queryParts} index={index} />
          <SortBySection query={queryParts} index={index} />
          <MenuSection index={index} totalQueryRows={totalQueryRows} />
        </Grid>
      </Grid>
      <Grid
        columns="2fr 1.2fr"
        gap="md"
        marginBottom="xl"
        data-test-id={`section-visualization-${index}`}
      >
        <LazyRender containerHeight={260} withoutContainer>
          <MultiQueryModeChart
            index={index}
            mode={mode}
            query={queryParts}
            timeseriesResult={timeseriesResult}
          />
          <MultiQueryTable
            mode={mode}
            query={queryParts}
            index={index}
            aggregatesTableResult={aggregatesTableResult}
            spansTableResult={spansTableResult}
          />
        </LazyRender>
      </Grid>
    </Fragment>
  );
}
