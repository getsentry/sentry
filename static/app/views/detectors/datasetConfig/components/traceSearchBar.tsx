import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {useTraceItemDatasetAttributes} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function TraceSearchBar({
  initialQuery,
  onSearch,
  onClose,
  projectIds,
  dataset,
  disabled,
}: DetectorSearchBarProps) {
  const organization = useOrganization();
  const supportsArrays = organization.features.includes('trace-item-array-query-support');
  const isLogs = dataset === DiscoverDatasets.OURLOGS;
  const traceDataset = isLogs ? TraceItemDataset.LOGS : TraceItemDataset.SPANS;

  const {attributes: numberAttributes, secondaryAliases: numberSecondaryAliases} =
    useTraceItemDatasetAttributes(traceDataset, {projects: projectIds}, 'number');
  const {attributes: stringAttributes, secondaryAliases: stringSecondaryAliases} =
    useTraceItemDatasetAttributes(traceDataset, {projects: projectIds}, 'string');
  const {attributes: booleanAttributes, secondaryAliases: booleanSecondaryAliases} =
    useTraceItemDatasetAttributes(traceDataset, {projects: projectIds}, 'boolean');
  const {attributes: arrayAttributes, secondaryAliases: arraySecondaryAliases} =
    useTraceItemDatasetAttributes(
      traceDataset,
      {projects: projectIds, enabled: supportsArrays},
      'array'
    );

  return (
    <TraceItemSearchQueryBuilder
      itemType={traceDataset}
      initialQuery={initialQuery}
      onSearch={onSearch}
      arrayAttributes={supportsArrays ? arrayAttributes : {}}
      booleanAttributes={booleanAttributes}
      numberAttributes={numberAttributes}
      numberSecondaryAliases={numberSecondaryAliases}
      stringAttributes={stringAttributes}
      arraySecondaryAliases={supportsArrays ? arraySecondaryAliases : {}}
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
