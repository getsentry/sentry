import {useEAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {WidgetBuilderSearchBarProps} from 'sentry/views/dashboards/datasetConfig/base';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';

/**
 * A search bar for exploring tags and values for spans in Dashboards.
 * This assumes that the dataset used is the EAP spans dataset.
 */
function SpansSearchBar({
  widgetQuery,
  onSearch,
  portalTarget,
  onClose,
}: Pick<
  WidgetBuilderSearchBarProps,
  'widgetQuery' | 'onSearch' | 'portalTarget' | 'onClose'
>) {
  const {
    selection: {projects},
  } = usePageFilters();
  const {tags: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemTags('number');
  const {tags: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemTags('string');

  const {traceItemSearchQueryBuilderProps} = useEAPSpanSearchQueryBuilderProps({
    initialQuery: widgetQuery.conditions,
    numberAttributes,
    stringAttributes,
    numberSecondaryAliases,
    stringSecondaryAliases,
    supportedAggregates: ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
    searchSource: 'dashboards',
    projects,
    portalTarget,
    onSearch,
    onChange: (query, state) => {
      onClose?.(query, {validSearch: state.queryIsValid});
    },
  });

  return <TraceItemSearchQueryBuilder {...traceItemSearchQueryBuilderProps} />;
}

export default SpansSearchBar;
