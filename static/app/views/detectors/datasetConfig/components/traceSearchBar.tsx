import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {ALLOWED_EXPLORE_VISUALIZE_AGGREGATES, FieldKind} from 'sentry/utils/fields';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {
  useTraceItemBooleanAttributes,
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
  disabled,
}: DetectorSearchBarProps) {
  const isLogs = dataset === DiscoverDatasets.OURLOGS;
  const traceDataset = isLogs ? TraceItemDataset.LOGS : TraceItemDataset.SPANS;
  const {attributes: numberAttributes} = useTraceItemNumberAttributes({
    traceItemType: traceDataset,
    projectIds,
  });
  const {attributes: booleanAttributes} = useTraceItemBooleanAttributes({
    traceItemType: traceDataset,
    projectIds,
  });

  const numberSecondaryAliases = useMemo(() => {
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(numberAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.MEASUREMENT}])
    );
    return secondaryAliases;
  }, [numberAttributes]);

  const {attributes: stringAttributes} = useTraceItemStringAttributes({
    traceItemType: traceDataset,
    projectIds,
  });

  const stringSecondaryAliases = useMemo(() => {
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(stringAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.TAG}])
    );
    return secondaryAliases;
  }, [stringAttributes]);

  const booleanSecondaryAliases = useMemo(() => {
    const secondaryAliases: TagCollection = Object.fromEntries(
      Object.values(booleanAttributes ?? {})
        .flatMap(value => value.secondaryAliases ?? [])
        .map(alias => [alias, {key: alias, name: alias, kind: FieldKind.BOOLEAN}])
    );
    return secondaryAliases;
  }, [booleanAttributes]);

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
