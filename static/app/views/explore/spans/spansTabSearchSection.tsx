import {Fragment, memo, useMemo, type Key} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import type {EAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  EAPSpanSearchQueryBuilder,
  useEAPSpanSearchQueryBuilderProps,
} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {TourElement} from 'sentry/components/tours/components';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  type AggregationKey,
} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import SchemaHintsList from 'sentry/views/explore/components/schemaHints/schemaHintsList';
import {SchemaHintsSources} from 'sentry/views/explore/components/schemaHints/schemaHintsUtils';
import {ExploreSchemaHintsSection} from 'sentry/views/explore/components/styles';
import {
  TraceItemSearchQueryBuilder,
  useSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {MAX_CROSS_EVENT_QUERIES} from 'sentry/views/explore/constants';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  useQueryParamsCrossEvents,
  useQueryParamsFields,
  useQueryParamsMode,
  useQueryParamsQuery,
  useSetQueryParams,
  useSetQueryParamsCrossEvents,
} from 'sentry/views/explore/queryParams/context';
import {
  isCrossEventType,
  type CrossEventType,
} from 'sentry/views/explore/queryParams/crossEvent';
import {SpansTabSeerComboBox} from 'sentry/views/explore/spans/spansTabSeerComboBox';
import {ExploreSpansTour, ExploreSpansTourContext} from 'sentry/views/explore/spans/tour';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {findSuggestedColumns} from 'sentry/views/explore/utils';

const crossEventDropdownItems: DropdownMenuProps['items'] = [
  {key: 'spans', label: t('Spans')},
  {key: 'logs', label: t('Logs')},
  {key: 'metrics', label: t('Metrics')},
];

function CrossEventQueryingDropdown() {
  const crossEvents = useQueryParamsCrossEvents();
  const setCrossEvents = useSetQueryParamsCrossEvents();

  const onAction = (key: Key) => {
    if (typeof key !== 'string' || !isCrossEventType(key)) {
      return;
    }

    if (!crossEvents || crossEvents.length === 0) {
      setCrossEvents([{query: '', type: key}]);
    } else {
      setCrossEvents([...crossEvents, {query: '', type: key}]);
    }
  };

  const isDisabled =
    defined(crossEvents) && crossEvents.length >= MAX_CROSS_EVENT_QUERIES;
  const tooltipTitle = isDisabled
    ? t('Maximum of %s cross event queries allowed.', MAX_CROSS_EVENT_QUERIES)
    : t('For more targeted results, you can also cross reference other datasets.');

  return (
    <Tooltip title={tooltipTitle}>
      <Container width="100%">
        {triggerProps => (
          <DropdownMenu
            onAction={onAction}
            items={crossEventDropdownItems}
            isDisabled={isDisabled}
            triggerProps={{
              ...triggerProps,
              size: 'md',
              showChevron: false,
              icon: <IconAdd />,
              'aria-label': t('Add a cross event query'),
            }}
          />
        )}
      </Container>
    </Tooltip>
  );
}

interface SpansTabCrossEventSearchBarProps {
  index: number;
  query: string;
  type: CrossEventType;
}

const SpansTabCrossEventSearchBar = memo(
  ({index, query, type}: SpansTabCrossEventSearchBarProps) => {
    const mode = useQueryParamsMode();
    const crossEvents = useQueryParamsCrossEvents();
    const setCrossEvents = useSetQueryParamsCrossEvents();

    const {tags: numberAttributes, secondaryAliases: numberSecondaryAliases} =
      useTraceItemTags('number');
    const {tags: stringAttributes, secondaryAliases: stringSecondaryAliases} =
      useTraceItemTags('string');

    const traceItemType =
      type === 'spans'
        ? TraceItemDataset.SPANS
        : type === 'logs'
          ? TraceItemDataset.LOGS
          : TraceItemDataset.TRACEMETRICS;

    const eapSpanSearchQueryBuilderProps = useMemo(
      () => ({
        initialQuery: query,
        onSearch: (newQuery: string) => {
          if (!crossEvents) return;

          setCrossEvents?.(
            crossEvents.map((c, i) => {
              if (i === index) return {query: newQuery, type};
              return c;
            })
          );
        },
        searchSource: 'explore',
        getFilterTokenWarning:
          mode === Mode.SAMPLES
            ? (key: string) => {
                if (
                  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.includes(key as AggregationKey)
                ) {
                  return t(
                    "This key won't affect the results because samples mode does not support aggregate functions"
                  );
                }
                return undefined;
              }
            : undefined,
        supportedAggregates:
          mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
        numberAttributes,
        stringAttributes,
        matchKeySuggestions: [
          {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
          {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
        ],
        numberSecondaryAliases,
        stringSecondaryAliases,
      }),
      [
        crossEvents,
        index,
        mode,
        numberSecondaryAliases,
        numberAttributes,
        query,
        setCrossEvents,
        stringSecondaryAliases,
        stringAttributes,
        type,
      ]
    );

    const searchQueryBuilderProps = useSearchQueryBuilderProps({
      itemType: traceItemType,
      ...eapSpanSearchQueryBuilderProps,
    });

    return (
      <SearchQueryBuilderProvider {...searchQueryBuilderProps}>
        <TraceItemSearchQueryBuilder
          itemType={traceItemType}
          {...eapSpanSearchQueryBuilderProps}
        />
      </SearchQueryBuilderProvider>
    );
  }
);

function SpansTabCrossEventSearchBars() {
  const crossEvents = useQueryParamsCrossEvents();
  const setCrossEvents = useSetQueryParamsCrossEvents();

  if (!crossEvents || crossEvents.length === 0) {
    return null;
  }

  return crossEvents.slice(0, MAX_CROSS_EVENT_QUERIES).map((crossEvent, index) => {
    const traceItemType =
      crossEvent.type === 'spans'
        ? TraceItemDataset.SPANS
        : crossEvent.type === 'logs'
          ? TraceItemDataset.LOGS
          : TraceItemDataset.TRACEMETRICS;

    return (
      <Fragment key={`${crossEvent.type}-${index}`}>
        <Container justifySelf="end" width={{sm: '100%', md: 'min-content'}}>
          {props => (
            <CompactSelect
              {...props}
              menuTitle={t('Dataset')}
              aria-label={t('Modify dataset to cross reference')}
              value={crossEvent.type}
              triggerProps={{
                prefix: t('with'),
                ...props,
              }}
              options={[
                {value: 'spans', label: t('Spans')},
                {value: 'logs', label: t('Logs')},
                {value: 'metrics', label: t('Metrics')},
              ]}
              onChange={({value: newValue}) => {
                if (!isCrossEventType(newValue)) return;

                setCrossEvents(
                  crossEvents.map((c, i) => {
                    if (i === index) return {query: '', type: newValue};
                    return c;
                  })
                );
              }}
            />
          )}
        </Container>
        <TraceItemAttributeProvider traceItemType={traceItemType} enabled>
          <SpansTabCrossEventSearchBar
            index={index}
            query={crossEvent.query}
            type={crossEvent.type}
          />
        </TraceItemAttributeProvider>
        <Button
          icon={<IconDelete />}
          aria-label={t('Remove cross event search for %s', crossEvent.type)}
          onClick={() => {
            setCrossEvents(crossEvents.filter((_, i) => i !== index));
          }}
        />
      </Fragment>
    );
  });
}

function SpansSearchBar({
  eapSpanSearchQueryBuilderProps,
}: {
  eapSpanSearchQueryBuilderProps: EAPSpanSearchQueryBuilderProps;
}) {
  const {displayAskSeer} = useSearchQueryBuilder();

  if (displayAskSeer) {
    return <SpansTabSeerComboBox />;
  }

  return <EAPSpanSearchQueryBuilder autoFocus {...eapSpanSearchQueryBuilderProps} />;
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
  const areAiFeaturesAllowed =
    !organization?.hideAiFeatures && organization.features.includes('gen-ai-features');
  const hasRawSearchReplacement = organization.features.includes(
    'search-query-builder-raw-search-replacement'
  );
  const hasCrossEventQueryingFlag = organization.features.includes(
    'traces-page-cross-event-querying'
  );

  const hasCrossEvents =
    hasCrossEventQueryingFlag && defined(crossEvents) && crossEvents.length > 0;

  const {
    tags: numberTags,
    isLoading: numberTagsLoading,
    secondaryAliases: numberSecondaryAliases,
  } = useTraceItemTags('number');
  const {
    tags: stringTags,
    isLoading: stringTagsLoading,
    secondaryAliases: stringSecondaryAliases,
  } = useTraceItemTags('string');

  const search = useMemo(() => new MutableSearch(query), [query]);
  const oldSearch = usePrevious(search);

  const eapSpanSearchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: query,
      onSearch: (newQuery: string) => {
        const newSearch = new MutableSearch(newQuery);
        const suggestedColumns = findSuggestedColumns(newSearch, oldSearch, {
          numberAttributes: numberTags,
          stringAttributes: stringTags,
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
      numberTags,
      stringTags,
      replaceRawSearchKeys: hasRawSearchReplacement ? ['span.description'] : undefined,
      matchKeySuggestions: [
        {key: 'trace', valuePattern: /^[0-9a-fA-F]{32}$/},
        {key: 'id', valuePattern: /^[0-9a-fA-F]{16}$/},
      ],
      numberSecondaryAliases,
      stringSecondaryAliases,
      caseInsensitive,
      onCaseInsensitiveClick: setCaseInsensitive,
    }),
    [
      caseInsensitive,
      fields,
      hasRawSearchReplacement,
      mode,
      numberSecondaryAliases,
      numberTags,
      oldSearch,
      query,
      setCaseInsensitive,
      setQueryParams,
      stringSecondaryAliases,
      stringTags,
    ]
  );

  const eapSpanSearchQueryProviderProps = useEAPSpanSearchQueryBuilderProps(
    eapSpanSearchQueryBuilderProps
  );

  return (
    <Layout.Main width="full">
      <SearchQueryBuilderProvider
        enableAISearch={areAiFeaturesAllowed}
        {...eapSpanSearchQueryProviderProps}
      >
        <TourElement<ExploreSpansTour>
          tourContext={ExploreSpansTourContext}
          id={ExploreSpansTour.SEARCH_BAR}
          title={t('Start Your Search')}
          description={t(
            'Specify the keys you’d like to narrow your search down to (ex. span.operation) and then any values (ex. db, res, http, etc.).'
          )}
          position="bottom"
          margin={-8}
        >
          <Grid gap="md" columns={{sm: '1fr', md: 'minmax(300px, auto) 1fr min-content'}}>
            <StyledPageFilterBar condensed>
              <ProjectPageFilter />
              <EnvironmentPageFilter />
              <DatePageFilter {...datePageFilterProps} />
            </StyledPageFilterBar>
            <SpansSearchBar
              eapSpanSearchQueryBuilderProps={eapSpanSearchQueryBuilderProps}
            />
            {hasCrossEventQueryingFlag ? <CrossEventQueryingDropdown /> : null}
            {hasCrossEvents ? <SpansTabCrossEventSearchBars /> : null}
          </Grid>
          {hasCrossEvents && crossEvents.length > MAX_CROSS_EVENT_QUERIES ? (
            <Container paddingTop="md">
              <Alert type="warning">
                {t(
                  'You can add up to a maximum of %s cross event queries.',
                  MAX_CROSS_EVENT_QUERIES
                )}
              </Alert>
            </Container>
          ) : null}
          {hasCrossEvents ? null : (
            <ExploreSchemaHintsSection>
              <SchemaHintsList
                supportedAggregates={
                  mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES
                }
                numberTags={numberTags}
                stringTags={stringTags}
                isLoading={numberTagsLoading || stringTagsLoading}
                exploreQuery={query}
                source={SchemaHintsSources.EXPLORE}
              />
            </ExploreSchemaHintsSection>
          )}
        </TourElement>
      </SearchQueryBuilderProvider>
    </Layout.Main>
  );
}

const StyledPageFilterBar = styled(PageFilterBar)`
  width: auto;
`;
