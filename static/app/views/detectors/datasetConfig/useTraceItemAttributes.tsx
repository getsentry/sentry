import {useMemo} from 'react';

import type {Tag, TagCollection} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';
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
  dataset: TraceItemDataset;
  projectIds: number[];
  type: 'string' | 'number';
  options?: Partial<UseApiQueryOptions<Tag[]>>;
}

function useTraceItemAttributeKeys({
  type,
  dataset,
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
          dataset,
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
  dataset,
  projectIds,
}: {
  dataset: TraceItemDataset;
  projectIds: number[];
}) {
  const {
    attributes: numberAttributes,
    isPending,
    error,
  } = useTraceItemAttributeKeys({
    type: 'number',
    dataset,
    projectIds,
  });

  const allNumberAttributes = useMemo((): TagCollection => {
    const measurements = getDefaultNumberAttributes(dataset).map(measurement => [
      measurement,
      {key: measurement, name: measurement, kind: FieldKind.MEASUREMENT},
    ]);

    return {...numberAttributes, ...Object.fromEntries(measurements)};
  }, [numberAttributes, dataset]);

  return {
    attributes: allNumberAttributes,
    error,
    isPending,
  };
}

export function useTraceItemStringAttributes({
  dataset,
  projectIds,
}: {
  dataset: TraceItemDataset;
  projectIds: number[];
}) {
  const {
    attributes: stringAttributes,
    isPending,
    error,
  } = useTraceItemAttributeKeys({
    type: 'string',
    dataset,
    projectIds,
  });

  const allStringAttributes = useMemo((): TagCollection => {
    const tags = getDefaultStringAttributes(dataset).map(tag => [
      tag,
      {key: tag, name: tag, kind: FieldKind.TAG},
    ]);

    return {...stringAttributes, ...Object.fromEntries(tags)};
  }, [stringAttributes, dataset]);

  return {
    attributes: allStringAttributes,
    error,
    isPending,
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
