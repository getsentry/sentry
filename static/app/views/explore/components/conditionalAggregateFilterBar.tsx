import {Container} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useLogItemAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {HiddenLogSearchFields} from 'sentry/views/explore/logs/constants';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE} from 'sentry/views/explore/utils/conditionalAggregate';

interface ConditionalAggregateFilterBarProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  searchSource: string;
  ['data-test-id']?: string;
  /**
   * Dataset whose attributes power the series filter. Defaults to spans.
   */
  itemType?: TraceItemDataset.SPANS | TraceItemDataset.LOGS;
  menuPresentation?: 'floating' | 'panel';
}

/**
 * Per-series search bar that attaches an Explore-style `_if` filter to a visualize
 * aggregate. Shared by Explore toolbar / column editor and Dashboards widget builder.
 */
export function ConditionalAggregateFilterBar({
  itemType = TraceItemDataset.SPANS,
  ...props
}: ConditionalAggregateFilterBarProps) {
  if (itemType === TraceItemDataset.LOGS) {
    return <LogsConditionalAggregateFilterBar {...props} />;
  }

  return <SpansConditionalAggregateFilterBar {...props} />;
}

function SpansConditionalAggregateFilterBar({
  initialQuery,
  onSearch,
  searchSource,
  menuPresentation,
  'data-test-id': dataTestId,
}: Omit<ConditionalAggregateFilterBarProps, 'itemType'>) {
  const {
    selection: {projects},
  } = usePageFilters();

  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects,
    initialQuery,
    onSearch,
    searchSource,
    placeholder: t('Filter spans for this series'),
    // Attribute-only: never offer visualize aggregates (p95, count, …) as keys.
    supportedAggregates: [],
  });

  return (
    <Container data-test-id={dataTestId} width="100%" minWidth="0">
      <TraceItemSearchQueryBuilder
        {...spanSearchQueryBuilderProps}
        showSearchIcon={false}
        menuPresentation={menuPresentation}
        // Parent panels (toolbar, slideover, modal) clip non-portaled menus; the full
        // width filter key menu anchors inside the bar, so turn it off for portaling.
        portalTarget={document.body}
        disableFullWidthFilterKeyMenu
        invalidFilterKeys={[
          ...(spanSearchQueryBuilderProps.invalidFilterKeys ?? []),
          ...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
        ]}
        invalidMessages={{
          [InvalidReason.INVALID_KEY]: CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE,
        }}
      />
    </Container>
  );
}

function LogsConditionalAggregateFilterBar({
  initialQuery,
  onSearch,
  searchSource,
  menuPresentation,
  'data-test-id': dataTestId,
}: Omit<ConditionalAggregateFilterBarProps, 'itemType'>) {
  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useLogItemAttributes({}, 'string', HiddenLogSearchFields);
  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useLogItemAttributes({}, 'number', HiddenLogSearchFields);
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useLogItemAttributes({}, 'boolean', HiddenLogSearchFields);

  return (
    <Container data-test-id={dataTestId} width="100%" minWidth="0">
      <TraceItemSearchQueryBuilder
        itemType={TraceItemDataset.LOGS}
        initialQuery={initialQuery}
        onSearch={onSearch}
        searchSource={searchSource}
        placeholder={t('Filter logs for this series')}
        // Attribute-only: never offer visualize aggregates (p95, count, …) as keys.
        supportedAggregates={[]}
        stringAttributes={stringAttributes}
        numberAttributes={numberAttributes}
        booleanAttributes={booleanAttributes}
        stringSecondaryAliases={stringSecondaryAliases}
        numberSecondaryAliases={numberSecondaryAliases}
        booleanSecondaryAliases={booleanSecondaryAliases}
        showSearchIcon={false}
        menuPresentation={menuPresentation}
        portalTarget={document.body}
        disableFullWidthFilterKeyMenu
        invalidFilterKeys={[...ALLOWED_EXPLORE_VISUALIZE_AGGREGATES]}
        invalidMessages={{
          [InvalidReason.INVALID_KEY]: CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE,
        }}
      />
    </Container>
  );
}
