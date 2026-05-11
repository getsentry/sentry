import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
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
import {HiddenTraceMetricSearchFields} from 'sentry/views/explore/metrics/constants';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  selectTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

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
  const {selection} = usePageFilters();
  const organization = useOrganization();
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

  const {data} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      query: traceMetricFilter,
      projectIds,
    }),
    enabled: Boolean(traceMetricFilter),
    select: selectTraceItemTagCollection(),
  });

  const visibleNumberTags = useMemo(() => {
    const staticNumberTags = SENTRY_TRACEMETRIC_NUMBER_TAGS.reduce<TagCollection>(
      (acc, key) => {
        if (!HiddenTraceMetricSearchFields.includes(key)) {
          acc[key] = {key, name: key, kind: FieldKind.MEASUREMENT};
        }
        return acc;
      },
      {}
    );

    return {
      ...staticNumberTags,
      ...Object.fromEntries(
        Object.entries(data?.numberAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.numberAttributes]);

  const visibleStringTags = useMemo(() => {
    const staticStringTags = SENTRY_TRACEMETRIC_STRING_TAGS.reduce<TagCollection>(
      (acc, key) => {
        if (!HiddenTraceMetricSearchFields.includes(key)) {
          acc[key] = {key, name: key, kind: FieldKind.FIELD};
        }
        return acc;
      },
      {}
    );

    return {
      ...staticStringTags,
      ...Object.fromEntries(
        Object.entries(data?.stringAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.stringAttributes]);

  const visibleBooleanTags = useMemo(() => {
    const staticBooleanTags = SENTRY_TRACEMETRIC_BOOLEAN_TAGS.reduce<TagCollection>(
      (acc, key) => {
        if (!HiddenTraceMetricSearchFields.includes(key)) {
          acc[key] = {key, name: key, kind: FieldKind.BOOLEAN};
        }
        return acc;
      },
      {}
    );

    return {
      ...staticBooleanTags,
      ...Object.fromEntries(
        Object.entries(data?.booleanAttributes ?? {}).filter(
          ([key]) => !HiddenTraceMetricSearchFields.includes(key)
        )
      ),
    };
  }, [data?.booleanAttributes]);

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
