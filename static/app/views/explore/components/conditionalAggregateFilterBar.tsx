import {Container} from '@sentry/scraps/layout';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {InvalidReason} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {CONDITIONAL_FILTER_AGGREGATE_INVALID_MESSAGE} from 'sentry/views/explore/utils/conditionalAggregate';

interface ConditionalAggregateFilterBarProps {
  initialQuery: string;
  onSearch: (query: string) => void;
  searchSource: string;
  ['data-test-id']?: string;
}

/**
 * Per-series search bar that attaches an Explore-style `_if` filter to a visualize
 * aggregate. Shared by Explore toolbar / column editor and Dashboards widget builder.
 */
export function ConditionalAggregateFilterBar({
  initialQuery,
  onSearch,
  searchSource,
  'data-test-id': dataTestId,
}: ConditionalAggregateFilterBarProps) {
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
