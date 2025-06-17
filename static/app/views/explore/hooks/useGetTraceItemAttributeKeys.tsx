import {useCallback} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  TraceItemDataset,
  UseTraceItemAttributeBaseProps,
} from 'sentry/views/explore/types';

interface UseGetTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  datetime?: PageFilters['datetime'];
  projectIds?: Array<string | number>;
}

function traceItemAttributeKeysQueryKey({
  orgSlug,
  traceItemType,
  datetime,
  projectIds,
  search,
  type,
}: {
  orgSlug: string;
  traceItemType: TraceItemDataset;
  type: 'string' | 'number';
  datetime?: PageFilters['datetime'];
  projectIds?: Array<string | number>;
  search?: string;
}): ApiQueryKey {
  const query: Record<string, string | string[] | number[]> = {
    itemType: traceItemType,
    attributeType: type,
  };

  if (search) {
    query.substringMatch = search;
  }

  if (projectIds?.length) {
    query.project = projectIds.map(String);
  }

  if (datetime) {
    Object.entries(normalizeDateTimeParams(datetime)).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value as string | string[];
      }
    });
  }

  return [`/organizations/${orgSlug}/trace-items/attributes/`, {query}];
}

export function useGetTraceItemAttributeKeys({
  traceItemType,
  projectIds,
  datetime,
  type,
}: UseGetTraceItemAttributeKeysProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const getTraceItemAttributeKeys = useCallback(
    async (queryString: string): Promise<TagCollection> => {
      const stringQueryKey = traceItemAttributeKeysQueryKey({
        orgSlug: organization.slug,
        traceItemType,
        type,
        datetime: datetime ?? selection.datetime,
        projectIds: projectIds ?? selection.projects,
        search: queryString,
      });

      try {
        const result = await api.requestPromise(stringQueryKey[0], {
          method: 'GET',
          query: {...stringQueryKey[1]?.query},
        });

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
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute keys: ${e}`);
      }
    },
    [api, organization, selection, traceItemType, projectIds, datetime, type]
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
