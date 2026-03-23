import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function TraceSearchBar({
  initialQuery,
  onSearch,
  onClose,
  projectIds,
  dataset,
  disabled,
}: DetectorSearchBarProps) {
  const isLogs = dataset === DiscoverDatasets.OURLOGS;
  const traceDataset = isLogs ? TraceItemDataset.LOGS : TraceItemDataset.SPANS;

  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemDatasetAttributes(traceDataset, {projects: projectIds}, 'number');
  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemDatasetAttributes(traceDataset, {projects: projectIds}, 'string');
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useTraceItemDatasetAttributes(traceDataset, {projects: projectIds}, 'boolean');

  return (
    <TraceItemSearchQueryBuilder
      itemType={traceDataset}
      initialQuery={initialQuery}
      onSearch={onSearch}
      booleanAttributes={booleanAttributes}
      numberAttributes={numberAttributes}
      numberSecondaryAliases={numberSecondaryAliases}
      stringAttributes={stringAttributes}
      booleanSecondaryAliases={booleanSecondaryAliases}
      stringSecondaryAliases={stringSecondaryAliases}
      supportedAggregates={isLogs ? [] : ALLOWED_EXPLORE_VISUALIZE_AGGREGATES}
      searchSource="detectors"
      projects={projectIds}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      disabled={disabled}
    />
  );
}
