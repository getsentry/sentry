import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderAI,
} from 'sentry/components/searchQueryBuilder/context';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {TourElement} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {usePrevious} from 'sentry/utils/usePrevious';
import {
  TraceItemSearchQueryBuilder,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useQueryParamsMode,
  useQueryParamsQuery,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {CrossEventQueryingDropdown} from 'sentry/views/explore/spans/crossEvents/crossEventQueryingDropdown';
import {SpansTabCrossEventSearchBars} from 'sentry/views/explore/spans/crossEvents/crossEventSearchBars';
import {useValidateSpansTab} from 'sentry/views/explore/spans/hooks/useValidateSpansTab';
import {SamplesModeAggregateFilterWarning} from 'sentry/views/explore/spans/samplesModeAggregateFilterWarning';
import {SPANS_BREAKDOWN_CURSOR_KEY} from 'sentry/views/explore/spans/spansQueryParams';
import {SpansTabSeerComboBox} from 'sentry/views/explore/spans/spansTabSeerComboBox';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {findSuggestedColumns} from 'sentry/views/explore/utils';

function SpansSearchBar({
  spanSearchQueryBuilderProps,
}: {
  spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
}) {
  const {displayAskSeer} = useSearchQueryBuilderAI();

  if (displayAskSeer) {
    return <SpansTabSeerComboBox />;
  }

  return <TraceItemSearchQueryBuilder autoFocus {...spanSearchQueryBuilderProps} />;
}

interface SpanTabSearchSectionProps {
  datePageFilterProps: DatePageFilterProps;
}

export function SpanTabSearchSection({datePageFilterProps}: SpanTabSearchSectionProps) {
  const mode = useQueryParamsMode();
  const fields = useQueryParamsFields();
  const query = useQueryParamsQuery();
  const crossEvents = useQueryParamsCrossEvents();
  const setQueryParams = useSetQueryParams();
  const [caseInsensitive, setCaseInsensitive] = useCaseInsensitivity();
  const {selection} = usePageFilters();

  const hasCrossEvents = defined(crossEvents) && crossEvents.length > 0;
  const hasAbsoluteDateSelection = Boolean(
    selection.datetime.start && selection.datetime.end && !selection.datetime.period
  );

  const {attributes: numberAttributes} = useSpanItemAttributes({}, 'number');
  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');
  const {data: validatedSearchQueryData} = useValidateSpansTab();

  const search = useMemo(() => new MutableSearch(query), [query]);
  const oldSearch = usePrevious(search);

  const searchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: query,
      onSearch: (newQuery: string) => {
        const newSearch = new MutableSearch(newQuery);
        const suggestedColumns = findSuggestedColumns(newSearch, oldSearch, {
          booleanAttributes,
          numberAttributes,
          stringAttributes,
        });

        const existingFields = new Set(fields);
        const newColumns = suggestedColumns.filter(col => !existingFields.has(col));

        setQueryParams({
          query: newQuery,
          fields: newColumns.length ? [...fields, ...newColumns] : undefined,
        });
      },
      searchSource: 'explore',
      getFilterTokenWarning:
        mode === Mode.SAMPLES
          ? (key: string) => {
              if (ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)) {
                return <SamplesModeAggregateFilterWarning />;
              }
              return;
            }
          : undefined,
      supportedAggregates:
        mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
      defaultToAskSeerOnFreeTextSearch: true,
      replaceRawSearchKeys: ['span.description'],
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
      caseInsensitive,
      onCaseInsensitiveClick: setCaseInsensitive,
      validatedSearchQueryData,
    }),
    [
      booleanAttributes,
      caseInsensitive,
      fields,
      mode,
      numberAttributes,
      oldSearch,
      query,
      setCaseInsensitive,
      setQueryParams,
      stringAttributes,
      validatedSearchQueryData,
    ]
  );

  const {spanSearchQueryBuilderProviderProps, spanSearchQueryBuilderProps} =
    useSpanSearchQueryBuilderProps(searchQueryBuilderProps);

  return (
    <Layout.Main width="full">
      <SearchQueryBuilderProvider
        enableAISearch
        aiSearchBadgeType="beta"
        {...spanSearchQueryBuilderProviderProps}
      >
        <TourElement<ExploreSpansTour>
          tourContext={ExploreSpansTourContext}
          id={ExploreSpansTour.SEARCH_BAR}
          title={t('Start Your Search')}
          description={t(
            "Specify the keys you'd like to narrow your search down to (ex. span.operation) and then any values (ex. db, res, http, etc.)."
          )}
          position="bottom"
          margin={-8}
        >
          {tourProps => (
            <div {...tourProps}>
              <Grid gap="md">
                <Grid
                  gap="md"
                  columns={{
                    'screen:sm': '1fr',
                    'screen:md': 'minmax(300px, auto) 1fr min-content',
                  }}
                >
                  <StyledPageFilterBar condensed>
                    <ProjectPageFilter
                      resetParamsOnChange={[SPANS_BREAKDOWN_CURSOR_KEY]}
                    />
                    <EnvironmentPageFilter
                      resetParamsOnChange={[SPANS_BREAKDOWN_CURSOR_KEY]}
                    />
                    <DatePageFilter
                      {...datePageFilterProps}
                      resetParamsOnChange={[SPANS_BREAKDOWN_CURSOR_KEY]}
                    />
                  </StyledPageFilterBar>
                  <SpansSearchBar
                    spanSearchQueryBuilderProps={spanSearchQueryBuilderProps}
                  />
                  <CrossEventQueryingDropdown />
                  {hasCrossEvents && !hasAbsoluteDateSelection ? (
                    <SpansTabCrossEventSearchBars />
                  ) : null}
                </Grid>
                {hasCrossEvents && hasAbsoluteDateSelection ? (
                  <SpansTabCrossEventSearchBars hasIndependentDateColumn />
                ) : null}
              </Grid>
            </div>
          )}
        </TourElement>
      </SearchQueryBuilderProvider>
    </Layout.Main>
  );
}

export const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
