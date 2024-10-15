import type React from 'react';
import {createContext, useContext, useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Tag, TagCollection} from 'sentry/types/group';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {FieldKind} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanIndexedField} from 'sentry/views/insights/types';
import {
  useSpanFieldStaticTags,
  useSpanFieldSupportedTags,
} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

type TypedSpanTags = {
  number: TagCollection;
  string: TagCollection;
};

const SpanTagsContext = createContext<TypedSpanTags | undefined>(undefined);

interface SpanTagsProviderProps {
  children: React.ReactNode;
  dataset: DiscoverDatasets;
}

export function SpanTagsProvider({children, dataset}: SpanTagsProviderProps) {
  const numericSpanFields: Set<string> = useMemo(() => {
    return new Set([
      SpanIndexedField.SPAN_DURATION,
      SpanIndexedField.SPAN_SELF_TIME,
      SpanIndexedField.INP,
      SpanIndexedField.INP_SCORE,
      SpanIndexedField.INP_SCORE_WEIGHT,
      SpanIndexedField.TOTAL_SCORE,
      SpanIndexedField.CACHE_ITEM_SIZE,
      SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE,
      SpanIndexedField.MESSAGING_MESSAGE_RECEIVE_LATENCY,
      SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT,
    ]);
  }, []);

  const supportedTags = useSpanFieldSupportedTags();

  const numberTags: TagCollection = useTypedSpanTags({
    enabled: dataset === DiscoverDatasets.SPANS_EAP,
    type: 'number',
  });

  const stringTags: TagCollection = useTypedSpanTags({
    enabled: dataset === DiscoverDatasets.SPANS_EAP,
    type: 'string',
  });

  const staticTags = useSpanFieldStaticTags();

  const allNumberTags = useMemo(() => {
    if (dataset === DiscoverDatasets.SPANS_INDEXED) {
      return {};
    }

    return {
      ...numberTags,
      ...Object.fromEntries(
        Object.entries(staticTags)
          .filter(([key, _]) => numericSpanFields.has(key))
          .map(([key, tag]) => [key, {...tag, kind: FieldKind.MEASUREMENT}])
      ),
    };
  }, [dataset, numberTags, numericSpanFields, staticTags]);

  const allStringTags = useMemo(() => {
    if (dataset === DiscoverDatasets.SPANS_INDEXED) {
      return supportedTags.data;
    }

    return {
      ...stringTags,
      ...Object.fromEntries(
        Object.entries(staticTags)
          .filter(([key, _]) => !numericSpanFields.has(key))
          .map(([key, tag]) => [key, {...tag, kind: FieldKind.TAG}])
      ),
    };
  }, [dataset, supportedTags, stringTags, staticTags, numericSpanFields]);

  const tags = {
    number: allNumberTags,
    string: allStringTags,
  };

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
      if (tag.key.startsWith('sentry.')) {
        continue;
      }

      // EAP spans contain tags with illegal characters
      if (!/^[a-zA-Z0-9_.:-]+$/.test(tag.key)) {
        continue;
      }

      const key = type === 'number' ? `tags[${tag.key},number]` : tag.key;

      allTags[key] = {
        key,
        name: tag.key,
        kind: type === 'number' ? FieldKind.MEASUREMENT : FieldKind.TAG,
      };
    }

    return allTags;
  }, [result, type]);

  return tags;
}
