import {useCallback} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  TraceItemDataset,
  UseTraceItemAttributeBaseProps,
} from 'sentry/views/explore/types';

interface UseGetTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  projectIds?: Array<string | number>;
}

type TraceItemAttributeKeyOptions = Pick<
  ReturnType<typeof normalizeDateTimeParams>,
  'end' | 'start' | 'statsPeriod' | 'utc'
> & {
  attributeType: 'string' | 'number';
  itemType: TraceItemDataset;
  project?: string[];
  substringMatch?: string;
};

export function makeTraceItemAttributeKeysQueryOptions({
  traceItemType,
  type,
  datetime,
  projectIds,
  search,
}: {
  datetime: PageFilters['datetime'];
  traceItemType: TraceItemDataset;
  type: 'string' | 'number';
  projectIds?: Array<string | number>;
  search?: string;
}): TraceItemAttributeKeyOptions {
  const options: TraceItemAttributeKeyOptions = {
    itemType: traceItemType,
    attributeType: type,
    project: projectIds?.map(String),
    substringMatch: search,
    ...normalizeDateTimeParams(datetime),
  };

  // environment left out intentionally as it's not supported

  return options;
}

export function useGetTraceItemAttributeKeys({
  traceItemType,
  projectIds,
  type,
}: UseGetTraceItemAttributeKeysProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const getTraceItemAttributeKeys = useCallback(
    async (queryString?: string): Promise<TagCollection> => {
      const options = makeTraceItemAttributeKeysQueryOptions({
        traceItemType,
        type,
        datetime: selection.datetime,
        projectIds: projectIds ?? selection.projects,
        search: queryString,
      });

      let result: Tag[];

      try {
        result = await api.requestPromise(
          `/organizations/${organization.slug}/trace-items/attributes/`,
          {
            method: 'GET',
            query: options,
          }
        );
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute keys: ${e}`);
      }

      const attributes: TagCollection = {};

      for (const attribute of result ?? []) {
        if (isKnownAttribute(attribute)) {
          continue;
        }

        // EAP spans contain tags with illegal characters
        // SnQL forbids `-` but is allowed in RPC. So add it back later
        if (
          !/^[a-zA-Z0-9_.:-]+$/.test(attribute.key) &&
          !/^tags\[[a-zA-Z0-9_.:-]+,number\]$/.test(attribute.key)
        ) {
          continue;
        }

        attributes[attribute.key] = {
          key: attribute.key,
          name: attribute.name,
          kind: type === 'number' ? FieldKind.MEASUREMENT : FieldKind.TAG,
        };
      }

      return attributes;
    },
    [api, organization, selection, traceItemType, projectIds, type]
  );

  return getTraceItemAttributeKeys;
}

function isKnownAttribute(attribute: Tag) {
  // For now, skip all the sentry. prefixed attributes as they
  // should be covered by the static attributes that will be
  // merged with these results.

  // For logs we include sentry.message.* since it contains params etc.
  if (
    attribute.key.startsWith('sentry.message.') ||
    attribute.key.startsWith('tags[sentry.message.')
  ) {
    return false;
  }

  return attribute.key.startsWith('sentry.') || attribute.key.startsWith('tags[sentry.');
}
