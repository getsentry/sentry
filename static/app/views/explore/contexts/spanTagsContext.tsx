import type React from 'react';
import {createContext, useContext, useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Tag, TagCollection} from 'sentry/types/group';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
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

    return numberTags;
  }, [dataset, numberTags]);

  const allStringTags = useMemo(() => {
    if (dataset === DiscoverDatasets.SPANS_INDEXED) {
      return supportedTags.data;
    }

    return {
      ...stringTags,
      ...staticTags,
    };
  }, [dataset, supportedTags, stringTags, staticTags]);

  const tags = {
    number: allNumberTags,
    string: allStringTags,
  };

  return <SpanTagsContext.Provider value={tags}>{children}</SpanTagsContext.Provider>;
}

export const useSpanTags = (type?: 'number' | 'string') => {
  const typedTags = useContext(SpanTagsContext);

  if (typedTags === undefined) {
    throw new Error('useSpanTags must be used within a SpanTagsProvider');
  }

  if (type === 'number') {
    return typedTags.number;
  }
  return typedTags.string;
};

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
    const allTags = {};

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

      allTags[tag.key] = {
        key: tag.key,
        name: tag.name,
      };
    }

    return allTags;
  }, [result]);

  return tags;
}
