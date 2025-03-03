import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {LazyRender} from 'sentry/components/lazyRender';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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
  useDeleteQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {GroupBySection} from 'sentry/views/explore/multiQueryMode/queryConstructors/groupBy';
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
  const deleteQuery = useDeleteQueryAtIndex();

  const {groupBys, query, yAxes, sortBys} = queryParts;
  const mode = getQueryMode(groupBys);

  const aggregatesTableResult = useMultiQueryTableAggregateMode({
    groupBys,
    query,
    yAxes,
    sortBys,
    enabled: mode === Mode.AGGREGATE,
  });

  const spansTableResult = useMultiQueryTableSampleMode({
    groupBys,
    query,
    yAxes,
    sortBys,
    enabled: mode === Mode.SAMPLES,
  });

  const {timeseriesResult, canUsePreviousResults} = useMultiQueryTimeseries({
    index,
    enabled: true,
  });

  useCompareAnalytics({
    aggregatesTableResult,
    index,
    query: queryParts,
    spansTableResult,
    timeseriesResult,
    queryType: mode === Mode.AGGREGATE ? 'aggregate' : 'samples',
  });

  return (
    <Fragment>
      <QueryConstructionSection>
        <SearchBarSection query={queryParts} index={index} />
        <DropDownGrid>
          <VisualizeSection query={queryParts} index={index} />
          <GroupBySection query={queryParts} index={index} />
          <SortBySection query={queryParts} index={index} />
          <DeleteButton
            borderless
            icon={<IconDelete />}
            size="zero"
            disabled={totalQueryRows === 1}
            onClick={() => deleteQuery(index)}
            aria-label={t('Delete Query')}
          />
        </DropDownGrid>
      </QueryConstructionSection>
      <QueryVisualizationSection data-test-id={`section-visualization-${index}`}>
        <LazyRender containerHeight={260} withoutContainer>
          <MultiQueryModeChart
            index={index}
            mode={mode}
            query={queryParts}
            timeseriesResult={timeseriesResult}
            canUsePreviousResults={canUsePreviousResults}
          />
          <MultiQueryTable
            confidences={[]}
            mode={mode}
            query={queryParts}
            index={index}
            aggregatesTableResult={aggregatesTableResult}
            spansTableResult={spansTableResult}
          />
        </LazyRender>
      </QueryVisualizationSection>
    </Fragment>
  );
}

const QueryConstructionSection = styled('div')`
  display: grid;
  gap: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(400px, 1fr) 1fr;
  }
`;

const DropDownGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, auto)) ${space(2)};
  align-items: center;
  gap: ${space(1)};
`;

const DeleteButton = styled(Button)`
  margin-top: ${space(2)};
`;

const QueryVisualizationSection = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;
