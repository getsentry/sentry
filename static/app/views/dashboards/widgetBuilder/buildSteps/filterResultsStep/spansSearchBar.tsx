import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {WidgetBuilderSearchBarProps} from 'sentry/views/dashboards/datasetConfig/base';
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
  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');
  return (
    <EAPSpanSearchQueryBuilder
      initialQuery={widgetQuery.conditions}
      onSearch={onSearch}
      numberTags={numberTags}
      stringTags={stringTags}
      supportedAggregates={ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
      searchSource="dashboards"
      projects={projects}
      portalTarget={portalTarget}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
    />
  );
}

export default SpansSearchBar;
