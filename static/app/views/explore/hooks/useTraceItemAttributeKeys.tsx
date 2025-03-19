import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import type {TraceItemDataset} from 'sentry/views/explore/types';

export interface UseTraceItemAttributeBaseProps {
  /**
   * The trace item type supported by the endpoint, currently only supports LOGS.
   */
  traceItemType: TraceItemDataset;
  /**
   * The attribute type supported by the endpoint, currently only supports string and number.
   */
  type: 'number' | 'string';
}

interface UseTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  enabled?: boolean;
}

export function useTraceItemAttributeKeys({
  enabled,
  type,
  traceItemType,
}: UseTraceItemAttributeKeysProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const path = `/organizations/${organization.slug}/trace-items/attributes/`;
  const endpointOptions = {
    query: {
      project: selection.projects,
      environment: selection.environments,
      ...normalizeDateTimeParams(selection.datetime),
      item_type: traceItemType,
      attribute_type: type,
    },
  };

  const result = useApiQuery<Tag[]>([path, endpointOptions], {
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const attributes: TagCollection = useMemo(() => {
    const allAttributes: TagCollection = {};

    for (const attribute of result.data ?? []) {
      // For now, skip all the sentry. prefixed attributes as they
      // should be covered by the static attributes that will be
      // merged with these results.
      if (
        attribute.key.startsWith('sentry.') ||
        attribute.key.startsWith('tags[sentry.')
      ) {
        continue;
      }

      // EAP spans contain tags with illegal characters
      // SnQL forbids `-` but is allowed in RPC. So add it back later
      if (
        !/^[a-zA-Z0-9_.:]+$/.test(attribute.key) &&
        !/^tags\[[a-zA-Z0-9_.:]+,number\]$/.test(attribute.key)
      ) {
        continue;
      }

      allAttributes[attribute.key] = {
        key: attribute.key,
        name: attribute.name,
        kind: type === 'number' ? FieldKind.MEASUREMENT : FieldKind.TAG,
      };
    }

    return allAttributes;
  }, [result.data, type]);

  const previousAttributes = usePrevious(attributes, result.isLoading);

  return {
    attributes: result.isLoading ? previousAttributes : attributes,
    isLoading: result.isLoading,
  };
}
