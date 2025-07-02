import {useMemo} from 'react';

import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {keepPreviousData, useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {
  SENTRY_LOG_NUMBER_TAGS,
  SENTRY_LOG_STRING_TAGS,
  SENTRY_SPAN_NUMBER_TAGS,
  SENTRY_SPAN_STRING_TAGS,
} from 'sentry/views/explore/constants';
import {
  getTraceItemTagCollection,
  makeTraceItemAttributeKeysQueryOptions,
} from 'sentry/views/explore/hooks/useGetTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface UseTraceItemAttributeKeysProps {
  projectIds: number[];
  traceItemType: TraceItemDataset;
  type: 'string' | 'number';
  options?: Partial<UseApiQueryOptions<Tag[]>>;
}

export function useTraceItemAttributeKeys({
  type,
  traceItemType,
  projectIds,
  options,
}: UseTraceItemAttributeKeysProps) {
  const organization = useOrganization();
  const {data, isFetching, error} = useApiQuery<Tag[]>(
    [
      `/organizations/${organization.slug}/trace-items/attributes/`,
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
    isLoading: isFetching,
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
    isLoading,
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

    return {...numberAttributes, ...Object.fromEntries(measurements)};
  }, [numberAttributes, traceItemType]);

  return {
    attributes: allNumberAttributes,
    error,
    isLoading,
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
    isLoading,
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

    return {...stringAttributes, ...Object.fromEntries(tags)};
  }, [stringAttributes, traceItemType]);

  return {
    attributes: allStringAttributes,
    error,
    isLoading,
  };
}

function getDefaultNumberAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_NUMBER_TAGS;
  }
  return SENTRY_LOG_NUMBER_TAGS;
}

function getDefaultStringAttributes(itemType: TraceItemDataset) {
  if (itemType === TraceItemDataset.SPANS) {
    return SENTRY_SPAN_STRING_TAGS;
  }
  return SENTRY_LOG_STRING_TAGS;
}
