import {useMemo} from 'react';

import type {TagCollection} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {prettifyTagKey} from 'sentry/utils/fields';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useMetricTraceDetail} from 'sentry/views/explore/metrics/hooks/useMetricTraceDetail';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {getTraceItemTagCollection} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

interface TraceItemTagCollections {
  booleanAttributes: TagCollection;
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
}

const EMPTY_TAG_COLLECTIONS: TraceItemTagCollections = {
  booleanAttributes: {},
  numberAttributes: {},
  stringAttributes: {},
};

export function useMetricFallbackAttributes({
  enabled,
  traceMetric,
}: {
  enabled: boolean;
  traceMetric: TraceMetric;
}) {
  const sampleResult = useMetricSamplesTable({
    disabled: !enabled,
    fields: [],
    limit: 1,
    traceMetric,
  });

  const firstSample = sampleResult.result.data?.[0];
  const canFetchTraceDetails =
    enabled &&
    defined(firstSample?.[TraceMetricKnownFieldKey.ID]) &&
    defined(firstSample?.[TraceMetricKnownFieldKey.PROJECT_ID]) &&
    defined(firstSample?.[TraceMetricKnownFieldKey.TRACE]);

  const traceDetailsResult = useMetricTraceDetail({
    metricId: String(firstSample?.[TraceMetricKnownFieldKey.ID] ?? ''),
    projectId: String(firstSample?.[TraceMetricKnownFieldKey.PROJECT_ID] ?? ''),
    traceId: String(firstSample?.[TraceMetricKnownFieldKey.TRACE] ?? ''),
    timestamp: getTimeStampFromTableDateField(
      firstSample?.[TraceMetricKnownFieldKey.TIMESTAMP]
    ),
    enabled: canFetchTraceDetails,
  });

  const attributes = useMemo(() => {
    return getTagCollectionsFromTraceItemAttributes(
      traceDetailsResult.data?.attributes ?? []
    );
  }, [traceDetailsResult.data?.attributes]);

  return {
    attributes,
    isLoading:
      enabled &&
      (sampleResult.result.isFetching ||
        !sampleResult.result.isFetched ||
        (canFetchTraceDetails && traceDetailsResult.isLoading)),
  };
}

function getTagCollectionsFromTraceItemAttributes(
  attributes: TraceItemResponseAttribute[]
): TraceItemTagCollections {
  if (attributes.length === 0) {
    return EMPTY_TAG_COLLECTIONS;
  }

  return getTraceItemTagCollection(
    attributes.map(attribute => ({
      attributeSource: {source_type: 'user'},
      attributeType: getTraceItemAttributeType(attribute),
      key: attribute.name,
      name: prettifyTagKey(attribute.name),
    }))
  );
}

function getTraceItemAttributeType(
  attribute: TraceItemResponseAttribute
): 'boolean' | 'number' | 'string' {
  if (attribute.type === 'int' || attribute.type === 'float') {
    return 'number';
  }

  if (attribute.type === 'bool') {
    return 'boolean';
  }

  return 'string';
}
