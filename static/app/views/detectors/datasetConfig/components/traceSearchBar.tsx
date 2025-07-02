import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {
  useTraceItemNumberAttributes,
  useTraceItemStringAttributes,
} from 'sentry/views/detectors/datasetConfig/useTraceItemAttributes';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function TraceSearchBar({
  initialQuery,
  onSearch,
  onClose,
  projectIds,
  dataset,
}: DetectorSearchBarProps) {
  const isLogs = dataset === DiscoverDatasets.OURLOGS;
  const traceDataset = isLogs ? TraceItemDataset.LOGS : TraceItemDataset.SPANS;
  const {attributes: numberAttributes} = useTraceItemNumberAttributes({
    traceItemType: traceDataset,
    projectIds,
  });

  const {attributes: stringAttributes} = useTraceItemStringAttributes({
    traceItemType: traceDataset,
    projectIds,
  });

  return (
    <TraceItemSearchQueryBuilder
      itemType={traceDataset}
      initialQuery={initialQuery}
      onSearch={onSearch}
      numberAttributes={numberAttributes}
      stringAttributes={stringAttributes}
      supportedAggregates={isLogs ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
      searchSource="detectors"
      projects={projectIds}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
    />
  );
}
