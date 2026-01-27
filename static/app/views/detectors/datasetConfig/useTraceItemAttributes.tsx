import {useMemo} from 'react';

import type {Tag, TagCollection} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {FieldKind} from 'sentry/utils/fields';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  HIDDEN_PREPROD_ATTRIBUTES,
  SENTRY_LOG_BOOLEAN_TAGS,
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
  SENTRY_PREPROD_BOOLEAN_TAGS,
  SENTRY_PREPROD_NUMBER_TAGS,
  SENTRY_PREPROD_STRING_TAGS,
  SENTRY_SPAN_BOOLEAN_TAGS,
  SENTRY_SPAN_NUMBER_TAGS,
  SENTRY_SPAN_STRING_TAGS,
  SENTRY_TRACEMETRIC_BOOLEAN_TAGS,
  SENTRY_TRACEMETRIC_NUMBER_TAGS,
  SENTRY_TRACEMETRIC_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {
  getTraceItemTagCollection,
  makeTraceItemAttributeKeysQueryOptions,
} from 'sentry/views/explore/hooks/useGetTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {removeHiddenKeys} from 'sentry/views/explore/utils';

interface UseTraceItemAttributeKeysProps {
  projectIds: number[];
  traceItemType: TraceItemDataset;
  type: 'string' | 'number' | 'boolean';
  options?: Partial<UseApiQueryOptions<Tag[]>>;
}

function useTraceItemAttributeKeys({
  type,
  traceItemType,
  projectIds,
  options,
}: UseTraceItemAttributeKeysProps) {
  const organization = useOrganization();
  const {data, isPending, error} = useApiQuery<Tag[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/trace-items/attributes/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: makeTraceItemAttributeKeysQueryOptions({
          traceItemType,
          type,
          datetime: {
            period: '14d',
            start: null,
            end: null,
            utc: null,
          },
          projectIds,
        }),
      },
    ],
    {
      placeholderData: keepPreviousData,
      staleTime: Infinity,
      ...options,
    }
  );

  const attributes = useMemo((): TagCollection => {
    if (!data) {
      return {};
    }

    return getTraceItemTagCollection(data, type);
  }, [data, type]);

  return {
    attributes,
    error,
    isPending,
  };
}

export function useTraceItemNumberAttributes({
  traceItemType,
  projectIds,
}: {
  projectIds: number[];
  traceItemType: TraceItemDataset;
}) {
  const {
    attributes: numberAttributes,
    isPending,
    error,
  } = useTraceItemAttributeKeys({
    type: 'number',
    traceItemType,
    projectIds,
  });

  const allNumberAttributes = useMemo((): TagCollection => {
    const measurements = getDefaultNumberAttributes(traceItemType).map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    const combined = {...numberAttributes, ...Object.fromEntries(measurements)};

    if (traceItemType === TraceItemDataset.PREPROD) {
      return removeHiddenKeys(combined, HIDDEN_PREPROD_ATTRIBUTES);
    }

    return combined;
  }, [numberAttributes, traceItemType]);

  return {
    attributes: allNumberAttributes,
    error,
    isPending,
  };
}

export function useTraceItemStringAttributes({
  traceItemType,
  projectIds,
}: {
  projectIds: number[];
  traceItemType: TraceItemDataset;
}) {
  const {
    attributes: stringAttributes,
    isPending,
    error,
  } = useTraceItemAttributeKeys({
    type: 'string',
    traceItemType,
    projectIds,
  });

  const allStringAttributes = useMemo((): TagCollection => {
    const tags = getDefaultStringAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);

    const combined = {...stringAttributes, ...Object.fromEntries(tags)};

    if (traceItemType === TraceItemDataset.PREPROD) {
      return removeHiddenKeys(combined, HIDDEN_PREPROD_ATTRIBUTES);
    }

    return combined;
  }, [stringAttributes, traceItemType]);

  return {
    attributes: allStringAttributes,
    error,
    isPending,
  };
}

export function useTraceItemBooleanAttributes({
  traceItemType,
  projectIds,
}: {
  projectIds: number[];
  traceItemType: TraceItemDataset;
}) {
  const organization = useOrganization();
  const hasBooleanFilters = organization.features.includes(
    'search-query-builder-explicit-boolean-filters'
  );
  const {
    attributes: booleanAttributes,
    isPending,
    error,
  } = useTraceItemAttributeKeys({
    type: 'boolean',
    traceItemType,
    projectIds,
    options: {
      enabled: hasBooleanFilters,
    },
  });

  const allBooleanAttributes = useMemo((): TagCollection => {
    if (!hasBooleanFilters) {
      return {};
    }

    const tags = getDefaultBooleanAttributes(traceItemType).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.BOOLEAN},
    ]);

    const combined = {...booleanAttributes, ...Object.fromEntries(tags)};

    if (traceItemType === TraceItemDataset.PREPROD) {
      return removeHiddenKeys(combined, HIDDEN_PREPROD_ATTRIBUTES);
    }

    return combined;
  }, [booleanAttributes, hasBooleanFilters, traceItemType]);

  return {
    attributes: allBooleanAttributes,
    error,
    isPending,
  };
}

function getDefaultNumberAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_NUMBER_TAGS;
  }
  if (itemType === TraceItemDataset.PREPROD) {
    return SENTRY_PREPROD_NUMBER_TAGS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SENTRY_TRACEMETRIC_NUMBER_TAGS;
  }
  return SENTRY_LOG_NUMBER_TAGS;
}

function getDefaultStringAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_STRING_TAGS;
  }
  if (itemType === TraceItemDataset.PREPROD) {
    return SENTRY_PREPROD_STRING_TAGS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SENTRY_TRACEMETRIC_STRING_TAGS;
  }
  return SENTRY_LOG_STRING_TAGS;
}

function getDefaultBooleanAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_BOOLEAN_TAGS;
  }
  if (itemType === TraceItemDataset.PREPROD) {
    return SENTRY_PREPROD_BOOLEAN_TAGS;
  }
  if (itemType === TraceItemDataset.TRACEMETRICS) {
    return SENTRY_TRACEMETRIC_BOOLEAN_TAGS;
  }
  return SENTRY_LOG_BOOLEAN_TAGS;
}
