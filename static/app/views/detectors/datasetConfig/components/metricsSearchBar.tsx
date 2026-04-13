import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  SENTRY_TRACEMETRIC_BOOLEAN_TAGS,
  SENTRY_TRACEMETRIC_NUMBER_TAGS,
  SENTRY_TRACEMETRIC_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

const EMPTY_TAG_COLLECTION: TagCollection = {};

/**
 * Search bar for the metrics detector that scopes attribute keys
 * to those co-occurring with the currently selected trace metric.
 */
export function MetricsDetectorSearchBar({
  initialQuery,
  onSearch,
  onClose,
  projectIds,
  disabled,
}: DetectorSearchBarProps) {
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );

  let traceMetric: {name: string; type: string} = {name: '', type: ''};
  try {
    ({traceMetric} = parseMetricAggregate(aggregateFunction ?? ''));
  } catch {
    // aggregateFunction may be unset during form init / dataset switching
  }
  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
    projectIds,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
    projectIds,
  });
  const {attributes: booleanTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'boolean',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
    projectIds,
  });

  const visibleNumberTags = useMemo(() => {
    const staticNumberTags = SENTRY_TRACEMETRIC_NUMBER_TAGS.reduce((acc, key) => {
      if (!HiddenTraceMetricSearchFields.includes(key)) {
        acc[key] = {key, name: key, kind: FieldKind.MEASUREMENT};
      }
      return acc;
    }, {} as TagCollection);

    return {
      ...staticNumberTags,
      ...Object.fromEntries(
        Object.entries(numberTags ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [numberTags]);

  const visibleStringTags = useMemo(() => {
    const staticStringTags = SENTRY_TRACEMETRIC_STRING_TAGS.reduce((acc, key) => {
      if (!HiddenTraceMetricSearchFields.includes(key)) {
        acc[key] = {key, name: key, kind: FieldKind.FIELD};
      }
      return acc;
    }, {} as TagCollection);

    return {
      ...staticStringTags,
      ...Object.fromEntries(
        Object.entries(stringTags ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [stringTags]);

  const visibleBooleanTags = useMemo(() => {
    const staticBooleanTags = SENTRY_TRACEMETRIC_BOOLEAN_TAGS.reduce((acc, key) => {
      if (!HiddenTraceMetricSearchFields.includes(key)) {
        acc[key] = {key, name: key, kind: FieldKind.BOOLEAN};
      }
      return acc;
    }, {} as TagCollection);

    return {
      ...staticBooleanTags,
      ...Object.fromEntries(
        Object.entries(booleanTags ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [booleanTags]);

  return (
    <TraceItemSearchQueryBuilder
      key={traceMetric.name}
      itemType={TraceItemDataset.TRACEMETRICS}
      initialQuery={initialQuery}
      onSearch={onSearch}
      booleanAttributes={visibleBooleanTags ?? EMPTY_TAG_COLLECTION}
      numberAttributes={visibleNumberTags ?? EMPTY_TAG_COLLECTION}
      numberSecondaryAliases={EMPTY_TAG_COLLECTION}
      stringAttributes={visibleStringTags ?? EMPTY_TAG_COLLECTION}
      booleanSecondaryAliases={EMPTY_TAG_COLLECTION}
      stringSecondaryAliases={EMPTY_TAG_COLLECTION}
      searchSource="detectors-metrics"
      projects={projectIds}
      namespace={traceMetric.name}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      disabled={disabled}
    />
  );
}
