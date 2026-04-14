import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TRACE_ITEM_ATTRIBUTE_STALE_TIME} from 'sentry/views/explore/constants';
import type {
  TraceItemDataset,
  UseTraceItemAttributeBaseProps,
} from 'sentry/views/explore/types';

interface UseGetTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  projectIds?: Array<string | number>;
  query?: string;
}

type TraceItemAttributeKeyOptions = Pick<
  ReturnType<typeof normalizeDateTimeParams>,
  'end' | 'start' | 'statsPeriod' | 'utc'
> & {
  attributeType: 'string' | 'number' | 'boolean';
  itemType: TraceItemDataset;
  project?: string[];
  query?: string;
  substringMatch?: string;
};

const QUERY_KEY = 'use-get-trace-item-attribute-keys';

export function makeTraceItemAttributeKeysQueryOptions({
  traceItemType,
  type,
  datetime,
  projectIds,
  search,
  query,
}: {
  datetime: PageFilters['datetime'];
  traceItemType: TraceItemDataset;
  type: 'string' | 'number' | 'boolean';
  projectIds?: Array<string | number>;
  query?: string;
  search?: string;
}): TraceItemAttributeKeyOptions {
  const substringMatch = search || undefined;
  const options: TraceItemAttributeKeyOptions = {
    itemType: traceItemType,
    attributeType: type,
    project: projectIds?.map(String),
    query,
    ...normalizeDateTimeParams(datetime),
    ...(substringMatch === undefined ? {} : {substringMatch}),
  };

  // environment left out intentionally as it's not supported

  return options;
}

export function useGetTraceItemAttributeKeys({
  traceItemType,
  projectIds,
  type,
  query,
}: UseGetTraceItemAttributeKeysProps) {
  const api = useApi();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutateAsync: getTraceItemAttributeKeys} = useMutation({
    mutationFn: async (queryString?: string): Promise<TagCollection> => {
      const options = makeTraceItemAttributeKeysQueryOptions({
        traceItemType,
        type,
        datetime: selection.datetime,
        projectIds: projectIds ?? selection.projects,
        search: queryString,
        query,
      });

      let result: Tag[];
      try {
        result = await queryClient.fetchQuery({
          queryKey: [QUERY_KEY, options, organization.slug],
          queryFn: () =>
            api.requestPromise(
              `/organizations/${organization.slug}/trace-items/attributes/`,
              {
                method: 'GET',
                query: options,
              }
            ),
          staleTime: TRACE_ITEM_ATTRIBUTE_STALE_TIME,
        });
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute keys: ${e}`);
      }

      return getTraceItemTagCollection(result, type);
    },
  });

  return getTraceItemAttributeKeys;
}

function getTraceItemTagCollection(
  result: Tag[],
  type: UseGetTraceItemAttributeKeysProps['type']
): TagCollection {
  const attributes: TagCollection = {};

  for (const attribute of result ?? []) {
    if (isKnownAttribute(attribute)) {
      continue;
    }

    // EAP spans contain tags with illegal characters
    // SnQL forbids `-` but is allowed in RPC. So add it back later
    if (
      !/^[\w.:-]+$/.test(attribute.key) &&
      !/^tags\[[\w.:-]+,(number|boolean)\]$/.test(attribute.key)
    ) {
      continue;
    }

    let kind = FieldKind.TAG;
    if (type === 'number') {
      kind = FieldKind.MEASUREMENT;
    } else if (type === 'boolean') {
      kind = FieldKind.BOOLEAN;
    }

    attributes[attribute.key] = {
      key: attribute.key,
      name: attribute.name,
      kind,
      secondaryAliases: attribute?.secondaryAliases ?? [],
    };
  }

  return attributes;
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
