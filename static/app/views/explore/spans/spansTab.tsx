import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {getDiffInMinutes} from 'sentry/components/charts/utils';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {
  EAPSpanSearchQueryBuilder,
  SpanSearchQueryBuilder,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {IconChevron} from 'sentry/icons/iconChevron';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  type AggregationKey,
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ExploreCharts} from 'sentry/views/explore/charts';
import {
  PageParamsProvider,
  useExploreDataset,
  useExploreMode,
  useExploreQuery,
  useExploreVisualizes,
  useSetExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {
  SpanTagsProvider,
  useSpanTags,
} from 'sentry/views/explore/contexts/spanTagsContext';
import {useAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useExploreAggregatesTable} from 'sentry/views/explore/hooks/useExploreAggregatesTable';
import {useExploreSpansTable} from 'sentry/views/explore/hooks/useExploreSpansTable';
import {useExploreTimeseries} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {useExploreTracesTable} from 'sentry/views/explore/hooks/useExploreTracesTable';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';
import {ExploreTables} from 'sentry/views/explore/tables';
import {ExploreToolbar} from 'sentry/views/explore/toolbar';
import {
  combineConfidenceForSeries,
  type DefaultPeriod,
  type MaxPickableDays,
} from 'sentry/views/explore/utils';

export type SpanTabProps = {
  defaultPeriod: DefaultPeriod;
  maxPickableDays: MaxPickableDays;
  relativeOptions: Record<string, React.ReactNode>;
};

export function SpansTabContentImpl({
  defaultPeriod,
  maxPickableDays,
  relativeOptions,
}: SpanTabProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const dataset = useExploreDataset();
  const mode = useExploreMode();
  const visualizes = useExploreVisualizes();
  const [samplesTab, setSamplesTab] = useTab();

  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const query = useExploreQuery();
  const setQuery = useSetExploreQuery();

  const toolbarExtras = organization?.features?.includes('visibility-explore-dataset')
    ? ['dataset toggle' as const]
    : [];

  const queryType: 'aggregate' | 'samples' | 'traces' =
    mode === Mode.AGGREGATE
      ? 'aggregate'
      : samplesTab === Tab.TRACE
        ? 'traces'
        : 'samples';

  const limit = 25;

  const isAllowedSelection = useMemo(
    () => checkIsAllowedSelection(selection, maxPickableDays),
    [selection, maxPickableDays]
  );

  const aggregatesTableResult = useExploreAggregatesTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'aggregate',
  });
  const spansTableResult = useExploreSpansTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'samples',
  });
  const tracesTableResult = useExploreTracesTable({
    query,
    limit,
    enabled: isAllowedSelection && queryType === 'traces',
  });
  const {timeseriesResult, canUsePreviousResults} = useExploreTimeseries({
    query,
    enabled: isAllowedSelection,
  });
  const confidences = useMemo(
    () =>
      visualizes.map(visualize => {
        const dedupedYAxes = dedupeArray(visualize.yAxes);
        const series = dedupedYAxes
          .flatMap(yAxis => timeseriesResult.data[yAxis])
          .filter(defined);
        return combineConfidenceForSeries(series);
      }),
    [timeseriesResult.data, visualizes]
  );

  const tableError =
    queryType === 'aggregate'
      ? aggregatesTableResult.result.error?.message ?? ''
      : queryType === 'traces'
        ? tracesTableResult.result.error?.message ?? ''
        : spansTableResult.result.error?.message ?? '';
  const chartError = timeseriesResult.error?.message ?? '';

  const [expanded, setExpanded] = useState(true);

  useAnalytics({
    queryType,
    aggregatesTableResult,
    spansTableResult,
    tracesTableResult,
    timeseriesResult,
  });

  return (
    <Body withToolbar={expanded}>
      <TopSection>
        <StyledPageFilterBar condensed>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter
            defaultPeriod={defaultPeriod}
            maxPickableDays={maxPickableDays}
            relativeOptions={({arbitraryOptions}) => ({
              ...arbitraryOptions,
              ...relativeOptions,
            })}
          />
        </StyledPageFilterBar>
        {dataset === DiscoverDatasets.SPANS_INDEXED ? (
          <SpanSearchQueryBuilder
            projects={selection.projects}
            initialQuery={query}
            onSearch={setQuery}
            searchSource="explore"
          />
        ) : (
          <EAPSpanSearchQueryBuilder
            projects={selection.projects}
            initialQuery={query}
            onSearch={setQuery}
            searchSource="explore"
            getFilterTokenWarning={
              mode === Mode.SAMPLES
                ? key => {
                    if (
                      ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)
                    ) {
                      return t(
                        "This key won't affect the results because samples mode does not support aggregate functions"
                      );
                    }
                    return undefined;
                  }
                : undefined
            }
            supportedAggregates={
              mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES
            }
            numberTags={numberTags}
            stringTags={stringTags}
          />
        )}
      </TopSection>
      <SideSection withToolbar={expanded}>
        <ExploreToolbar width={300} extras={toolbarExtras} />
      </SideSection>
      <section>
        {(tableError || chartError) && (
          <Alert.Container>
            <Alert type="error" showIcon>
              {tableError || chartError}
            </Alert>
          </Alert.Container>
        )}
        <MainContent>
          <ExploreCharts
            canUsePreviousResults={canUsePreviousResults}
            confidences={confidences}
            query={query}
            timeseriesResult={timeseriesResult}
          />
          <ExploreTables
            aggregatesTableResult={aggregatesTableResult}
            spansTableResult={spansTableResult}
            tracesTableResult={tracesTableResult}
            confidences={confidences}
            samplesTab={samplesTab}
            setSamplesTab={setSamplesTab}
          />
          <Toggle>
            <StyledButton
              aria-label={expanded ? t('Collapse sidebar') : t('Expande sidebar')}
              size="xs"
              icon={<IconDoubleChevron direction={expanded ? 'left' : 'right'} />}
              onClick={() => setExpanded(!expanded)}
            />
          </Toggle>
        </MainContent>
      </section>
    </Body>
  );
}

function IconDoubleChevron(props: React.ComponentProps<typeof IconChevron>) {
  return (
    <DoubleChevronWrapper>
      <IconChevron style={{marginRight: `-3px`}} {...props} />
      <IconChevron style={{marginLeft: `-3px`}} {...props} />
    </DoubleChevronWrapper>
  );
}

function ExploreTagsProvider({children}: any) {
  const dataset = useExploreDataset();

  return (
    <SpanTagsProvider dataset={dataset} enabled>
      {children}
    </SpanTagsProvider>
  );
}

export function SpansTabContent(props: SpanTabProps) {
  Sentry.setTag('explore.visited', 'yes');

  return (
    <PageParamsProvider>
      <ExploreTagsProvider>
        <SpansTabContentImpl {...props} />
      </ExploreTagsProvider>
    </PageParamsProvider>
  );
}

function checkIsAllowedSelection(
  selection: PageFilters,
  maxPickableDays: MaxPickableDays
) {
  const maxPickableMinutes = maxPickableDays * 24 * 60;
  const selectedMinutes = getDiffInMinutes(selection.datetime);
  return selectedMinutes <= maxPickableMinutes;
}

const Body = styled(Layout.Body)<{withToolbar: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: grid;
    ${p =>
      p.withToolbar
        ? `grid-template-columns: 300px minmax(100px, auto);`
        : `grid-template-columns: 0px minmax(100px, auto);`}
    grid-template-rows: auto 1fr;
    align-content: start;
    gap: ${space(2)} ${p => (p.withToolbar ? `${space(2)}` : '0px')};
    transition: 700ms;
  }
`;

const TopSection = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-column: 1/3;
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: minmax(300px, auto) 1fr;
    margin-bottom: 0;
  }
`;

const SideSection = styled('aside')<{withToolbar: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    ${p => !p.withToolbar && 'overflow: hidden;'}
  }
`;

const MainContent = styled('div')`
  position: relative;
  max-width: 100%;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;

const Toggle = styled('div')`
  display: none;
  position: absolute;
  top: 0px;

  z-index: 1; /* place above loading mask */

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;

const StyledButton = styled(Button)`
  width: 28px;
  border-left: 0px;
  border-top-left-radius: 0px;
  border-bottom-left-radius: 0px;
`;

const DoubleChevronWrapper = styled('div')`
  display: flex;
`;
