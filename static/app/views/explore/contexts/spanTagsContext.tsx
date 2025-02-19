import type React from 'react';
import {createContext, useContext, useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Tag, TagCollection} from 'sentry/types/group';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldKind} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {useSpanFieldCustomTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

import {SENTRY_SPAN_NUMBER_TAGS, SENTRY_SPAN_STRING_TAGS} from '../constants';

type TypedSpanTags = {
  number: TagCollection;
  string: TagCollection;
};

export const SpanTagsContext = createContext<TypedSpanTags | undefined>(undefined);

interface SpanTagsProviderProps {
  children: React.ReactNode;
  dataset: DiscoverDatasets;
  enabled: boolean;
}

export function SpanTagsProvider({children, dataset, enabled}: SpanTagsProviderProps) {
  const {data: indexedTags} = useSpanFieldCustomTags({
    enabled: dataset === DiscoverDatasets.SPANS_INDEXED && enabled,
  });

  const isEAP =
    dataset === DiscoverDatasets.SPANS_EAP || dataset === DiscoverDatasets.SPANS_EAP_RPC;

  const numberTags = useTypedSpanTags({
    enabled: isEAP && enabled,
    type: 'number',
  });

  const stringTags = useTypedSpanTags({
    enabled: isEAP && enabled,
    type: 'string',
  });

  const allNumberTags = useMemo(() => {
    const measurements = SENTRY_SPAN_NUMBER_TAGS.map(measurement => [
      measurement,
      {
        key: measurement,
        name: measurement,
        kind: FieldKind.MEASUREMENT,
      },
    ]);

    if (dataset === DiscoverDatasets.SPANS_INDEXED) {
      return {
        ...Object.fromEntries(measurements),
      };
    }

    return {
      ...numberTags,
      ...Object.fromEntries(measurements),
    };
  }, [dataset, numberTags]);

  const allStringTags = useMemo(() => {
    const tags = SENTRY_SPAN_STRING_TAGS.map(tag => [
      tag,
      {
        key: tag,
        name: tag,
        kind: FieldKind.TAG,
      },
    ]);

    if (dataset === DiscoverDatasets.SPANS_INDEXED) {
      return {
        ...indexedTags,
        ...Object.fromEntries(tags),
      };
    }

    return {
      ...stringTags,
      ...Object.fromEntries(tags),
    };
  }, [dataset, indexedTags, stringTags]);

  const tags = useMemo(() => {
    return {
      number: allNumberTags,
      string: allStringTags,
    };
  }, [allNumberTags, allStringTags]);

  return <SpanTagsContext.Provider value={tags}>{children}</SpanTagsContext.Provider>;
}

export function useSpanTags(type?: 'number' | 'string') {
  const typedTags = useContext(SpanTagsContext);

  if (typedTags === undefined) {
    throw new Error('useSpanTags must be used within a SpanTagsProvider');
  }

  if (type === 'number') {
    return typedTags.number;
  }
  return typedTags.string;
}

export function useSpanTag(key: string) {
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  return stringTags[key] ?? numberTags[key] ?? null;
}

function useTypedSpanTags({
  enabled,
  type,
}: {
  type: 'number' | 'string';
  enabled?: boolean;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/spans/fields/`;
  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      dataset: 'spans',
      type,
    },
  };

  const result = useApiQuery<Tag[]>([path, endpointOptions], {
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const tags: TagCollection = useMemo(() => {
    const allTags: TagCollection = {};

    for (const tag of result.data ?? []) {
      // For now, skip all the sentry. prefixed tags as they
      // should be covered by the static tags that will be
      // merged with these results.
      if (tag.key.startsWith('sentry.') || tag.key.startsWith('tags[sentry.')) {
        continue;
      }

      // EAP spans contain tags with illegal characters
      // SnQL forbids `-` but is allowed in RPC. So add it back later
      if (
        !/^[a-zA-Z0-9_.:]+$/.test(tag.key) &&
        !/^tags\[[a-zA-Z0-9_.:]+,number\]$/.test(tag.key)
      ) {
        continue;
      }

      allTags[tag.key] = {
        key: tag.key,
        name: tag.name,
        kind: type === 'number' ? FieldKind.MEASUREMENT : FieldKind.TAG,
      };
    }

    return allTags;
  }, [result.data, type]);

  const previousTags = usePrevious(tags, result.isLoading);

  return result.isLoading ? previousTags : tags;
}
