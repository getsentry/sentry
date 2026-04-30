import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/pageFilters/date/datePageFilter';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/pageFilters/environment/environmentPageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {TourElement} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useOrganization} from 'sentry/utils/useOrganization';
import {usePrevious} from 'sentry/utils/usePrevious';
import {SchemaHintsList} from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {ExploreSchemaHintsSection} from 'sentry/views/explore/components/styles';
import {
  TraceItemSearchQueryBuilder,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useQueryParamsMode,
  useQueryParamsQuery,
  useSetQueryParams,
} from 'sentry/views/explore/queryParams/context';
import {CrossEventQueryingDropdown} from 'sentry/views/explore/spans/crossEvents/crossEventQueryingDropdown';
import {SpansTabCrossEventSearchBars} from 'sentry/views/explore/spans/crossEvents/crossEventSearchBars';
import {SpansTabSeerComboBox} from 'sentry/views/explore/spans/spansTabSeerComboBox';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {findSuggestedColumns} from 'sentry/views/explore/utils';

function SpansSearchBar({
  spanSearchQueryBuilderProps,
}: {
  spanSearchQueryBuilderProps: TraceItemSearchQueryBuilderProps;
}) {
  const {displayAskSeer} = useSearchQueryBuilder();

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

  const organization = useOrganization();
  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );
  const hasCrossEventQueryingFlag = organization.features.includes(
    'traces-page-cross-event-querying'
  );

  const hasCrossEvents =
    hasCrossEventQueryingFlag && defined(crossEvents) && crossEvents.length > 0;

  const {attributes: numberAttributes, isLoading: numberAttributesLoading} =
    useSpanItemAttributes({}, 'number');
  const {attributes: stringAttributes, isLoading: stringAttributesLoading} =
    useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes, isLoading: booleanAttributesLoading} =
    useSpanItemAttributes({}, 'boolean');

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
                return t(
                  "This key won't affect the results because samples mode does not support aggregate functions"
                );
              }
              return undefined;
            }
          : undefined,
      supportedAggregates:
        mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
      caseInsensitive,
      onCaseInsensitiveClick: setCaseInsensitive,
    }),
    [
      booleanAttributes,
      caseInsensitive,
      fields,
      hasRawSearchReplacement,
      mode,
      numberAttributes,
      oldSearch,
      query,
      setCaseInsensitive,
      setQueryParams,
      stringAttributes,
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
              <Grid
                gap="md"
                columns={{sm: '1fr', md: 'minmax(300px, auto) 1fr min-content'}}
              >
                <StyledPageFilterBar condensed>
                  <ProjectPageFilter />
                  <EnvironmentPageFilter />
                  <DatePageFilter {...datePageFilterProps} />
                </StyledPageFilterBar>
                <SpansSearchBar
                  spanSearchQueryBuilderProps={spanSearchQueryBuilderProps}
                />
                {hasCrossEventQueryingFlag ? <CrossEventQueryingDropdown /> : null}
                {hasCrossEvents ? <SpansTabCrossEventSearchBars /> : null}
              </Grid>
              {hasCrossEvents ? null : (
                <ExploreSchemaHintsSection>
                  <SchemaHintsList
                    supportedAggregates={
                      mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES
                    }
                    booleanTags={booleanAttributes}
                    numberTags={numberAttributes}
                    stringTags={stringAttributes}
                    isLoading={
                      numberAttributesLoading ||
                      stringAttributesLoading ||
                      booleanAttributesLoading
                    }
                    exploreQuery={query}
                    source={SchemaHintsSources.EXPLORE}
                  />
                </ExploreSchemaHintsSection>
              )}
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
