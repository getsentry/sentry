import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {WidgetBuilderSearchBarProps} from 'sentry/views/dashboards/datasetConfig/base';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';

/**
 * A search bar for exploring tags and values for spans in Dashboards.
 * This assumes that the dataset used is the EAP spans dataset.
 */
function SpansSearchBar({
  widgetQuery,
  onSearch,
}: Pick<WidgetBuilderSearchBarProps, 'widgetQuery' | 'onSearch'>) {
  const {
    selection: {projects},
  } = usePageFilters();
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');
  return (
    <EAPSpanSearchQueryBuilder
      initialQuery={widgetQuery.conditions}
      onSearch={onSearch}
      numberTags={numberTags}
      stringTags={stringTags}
      supportedAggregates={ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
      searchSource="dashboards"
      projects={projects}
    />
  );
}

export default SpansSearchBar;
