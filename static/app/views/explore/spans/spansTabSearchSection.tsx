import {Fragment, memo, useEffect, useEffectEvent, useMemo, type Key} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import type {DatePageFilterProps} from 'sentry/components/organizations/datePageFilter';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {TourElement} from 'sentry/components/tours/components';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
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
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
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
  const organization = useOrganization();
  const crossEvents = useQueryParamsCrossEvents();
  const setCrossEvents = useSetQueryParamsCrossEvents();

  const onAction = (key: Key) => {
    if (typeof key !== 'string' || !isCrossEventType(key)) {
      return;
    }

    trackAnalytics('trace.explorer.cross_event_added', {
      organization,
      type: key,
    });

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
    <Container width="100%">
      {triggerProps => (
        <DropdownMenu
          onAction={onAction}
          items={crossEventDropdownItems}
          isDisabled={isDisabled}
          triggerProps={{
            ...triggerProps,
            title: tooltipTitle,
            size: 'md',
            showChevron: false,
            icon: <IconAdd />,
            'aria-label': t('Add a cross event query'),
          }}
        />
      )}
    </Container>
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

    const searchQueryBuilderProps = useTraceItemSearchQueryBuilderProps({
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
  const organization = useOrganization();
  const crossEvents = useQueryParamsCrossEvents();
  const setCrossEvents = useSetQueryParamsCrossEvents();

  // Using an effect event here to make sure we're reading only the latest props and not
  // firing based off of the cross events changing
  const fireErrorToast = useEffectEvent(() => {
    if (defined(crossEvents) && crossEvents.length > MAX_CROSS_EVENT_QUERIES) {
      addErrorMessage(
        t(
          'You can add up to a maximum of %s cross event queries.',
          MAX_CROSS_EVENT_QUERIES
        )
      );
    }
  });

  useEffect(() => {
    fireErrorToast();
  }, []);

  if (!crossEvents || crossEvents.length === 0) {
    return null;
  }

  return crossEvents.map((crossEvent, index) => {
    const traceItemType =
      crossEvent.type === 'spans'
        ? TraceItemDataset.SPANS
        : crossEvent.type === 'logs'
          ? TraceItemDataset.LOGS
          : TraceItemDataset.TRACEMETRICS;

    const maxCrossEventQueriesReached = index >= MAX_CROSS_EVENT_QUERIES;

    return (
      <Fragment key={`${crossEvent.type}-${index}`}>
        <Container justifySelf="end" width={{sm: '100%', md: 'min-content'}}>
          {props => (
            <CompactSelect
              {...props}
              menuTitle={t('Dataset')}
              aria-label={t('Modify dataset to cross reference')}
              value={crossEvent.type}
              disabled={maxCrossEventQueriesReached}
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} {...props} prefix={t('with')} />
              )}
              options={[
                {value: 'spans', label: t('Spans')},
                {value: 'logs', label: t('Logs')},
                {value: 'metrics', label: t('Metrics')},
              ]}
              onChange={({value: newValue}) => {
                if (!isCrossEventType(newValue)) return;

                trackAnalytics('trace.explorer.cross_event_changed', {
                  organization,
                  new_type: newValue,
                  old_type: crossEvent.type,
                });

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
        {maxCrossEventQueriesReached ? (
          <SearchQueryBuilderProvider
            filterKeys={{}}
            getTagValues={() => Promise.resolve([])}
            initialQuery=""
            searchSource="explore"
          >
            <TraceItemSearchQueryBuilder
              disabled
              itemType={traceItemType}
              initialQuery={crossEvent.query}
              numberAttributes={{}}
              stringAttributes={{}}
              numberSecondaryAliases={{}}
              stringSecondaryAliases={{}}
              searchSource="explore"
              getFilterTokenWarning={() => undefined}
              supportedAggregates={[]}
              onSearch={() => {}}
              onChange={() => {
                return;
              }}
            />
          </SearchQueryBuilderProvider>
        ) : (
          <TraceItemAttributeProvider traceItemType={traceItemType} enabled>
            <SpansTabCrossEventSearchBar
              index={index}
              query={crossEvent.query}
              type={crossEvent.type}
            />
          </TraceItemAttributeProvider>
        )}
        <Button
          icon={<IconDelete />}
          aria-label={t('Remove cross event search for %s', crossEvent.type)}
          onClick={() => {
            // we add 1 here to the max because the current cross event is being removed
            if (crossEvents.length > MAX_CROSS_EVENT_QUERIES + 1) {
              addErrorMessage(
                t(
                  'You can add up to a maximum of %s cross event queries.',
                  MAX_CROSS_EVENT_QUERIES
                )
              );
            }
            trackAnalytics('trace.explorer.cross_event_removed', {
              organization,
              type: crossEvent.type,
            });
            setCrossEvents(crossEvents.filter((_, i) => i !== index));
          }}
        />
      </Fragment>
    );
  });
}

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

  const {tags: numberAttributes, isLoading: numberAttributesLoading} =
    useTraceItemTags('number');
  const {tags: stringAttributes, isLoading: stringAttributesLoading} =
    useTraceItemTags('string');

  const search = useMemo(() => new MutableSearch(query), [query]);
  const oldSearch = usePrevious(search);

  const searchQueryBuilderProps = useMemo(
    () => ({
      initialQuery: query,
      onSearch: (newQuery: string) => {
        const newSearch = new MutableSearch(newQuery);
        const suggestedColumns = findSuggestedColumns(newSearch, oldSearch, {
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
        enableAISearch={areAiFeaturesAllowed}
        {...spanSearchQueryBuilderProviderProps}
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
            <SpansSearchBar spanSearchQueryBuilderProps={spanSearchQueryBuilderProps} />
            {hasCrossEventQueryingFlag ? <CrossEventQueryingDropdown /> : null}
            {hasCrossEvents ? <SpansTabCrossEventSearchBars /> : null}
          </Grid>
          {hasCrossEvents ? null : (
            <ExploreSchemaHintsSection>
              <SchemaHintsList
                supportedAggregates={
                  mode === Mode.SAMPLES ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES
                }
                numberTags={numberAttributes}
                stringTags={stringAttributes}
                isLoading={numberAttributesLoading || stringAttributesLoading}
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
