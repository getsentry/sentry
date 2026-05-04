import {queryOptions, type QueryFunctionContext} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {FieldKind} from 'sentry/utils/fields';
import type {TraceItemDataset} from 'sentry/views/explore/types';
import {findFreshEmptyPrefixSearchCacheMatch} from 'sentry/views/explore/utils/findFreshEmptyPrefixSearchCacheMatch';

type AttributeType = {
  attributeSource: {
    source_type: string;
  };
  attributeType: TraceItemAttributeType;
  key: string;
  name: string;
  secondaryAliases?: string[];
};

type TraceItemAttributeType = 'string' | 'number' | 'boolean';

type TraceItemAttributeKeyOptions = Pick<
  ReturnType<typeof normalizeDateTimeParams>,
  'end' | 'start' | 'statsPeriod' | 'utc'
> & {
  attributeType: TraceItemAttributeType | TraceItemAttributeType[];
  itemType: TraceItemDataset;
  project?: string[];
  query?: string;
  substringMatch?: string;
};

interface TraceItemAttributeKeysOptions {
  organization: Organization;
  selection: PageFilters;
  traceItemType: TraceItemDataset;
  projectIds?: Array<string | number>;
  projects?: Project[];
  query?: string;
  search?: string;
  staleTime?: number;
  type?: TraceItemAttributeType | TraceItemAttributeType[];
}

export function traceItemAttributeKeysOptions({
  organization,
  selection,
  staleTime = 0,
  traceItemType,
  type = ['string', 'number', 'boolean'],
  projects,
  projectIds: explicitProjectIds,
  query,
  search,
}: TraceItemAttributeKeysOptions) {
  const projectIds =
    explicitProjectIds ??
    (defined(projects) ? projects.map(project => project.id) : selection.projects);

  const substringMatch = search || undefined;
  const options: TraceItemAttributeKeyOptions = {
    itemType: traceItemType,
    attributeType: type,
    project: projectIds?.map(String),
    query,
    ...normalizeDateTimeParams(selection.datetime),
    ...(substringMatch === undefined ? {} : {substringMatch}),
  };

  const baseOptions = apiOptions.as<AttributeType[]>()(
    '/organizations/$organizationIdOrSlug/trace-items/attributes/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime,
      query: options,
    }
  );

  const originalQueryFn = baseOptions.queryFn;
  if (typeof originalQueryFn !== 'function') {
    return baseOptions;
  }

  return queryOptions({
    ...baseOptions,
    queryFn: (ctx: QueryFunctionContext<ApiQueryKey>) => {
      return (
        findFreshEmptyPrefixSearchCacheMatch({
          client: ctx.client,
          currentKey: ctx.queryKey,
        }) ?? originalQueryFn(ctx)
      );
    },
  });
}

type TraceItemTagCollections = {
  booleanAttributes: TagCollection;
  numberAttributes: TagCollection;
  stringAttributes: TagCollection;
};

export function selectTraceItemTagCollection(): (
  data: ApiResponse<AttributeType[]>
) => TraceItemTagCollections;

export function selectTraceItemTagCollection(
  type: TraceItemAttributeType
): (data: ApiResponse<AttributeType[]>) => TagCollection;

export function selectTraceItemTagCollection(
  type: TraceItemAttributeType[]
): (data: ApiResponse<AttributeType[]>) => TraceItemTagCollections;

export function selectTraceItemTagCollection(
  type?: TraceItemAttributeKeysOptions['type']
): (data: ApiResponse<AttributeType[]>) => TagCollection | TraceItemTagCollections {
  return function (data: ApiResponse<AttributeType[]>) {
    const {json} = selectJsonWithHeaders(data);

    if (type === undefined || Array.isArray(type)) {
      return getTraceItemTagCollection(json);
    }

    return getTraceItemTagCollection(json, type);
  };
}

export function getTraceItemTagCollection(
  result: AttributeType[]
): TraceItemTagCollections;

export function getTraceItemTagCollection(
  result: AttributeType[],
  type: TraceItemAttributeType
): TagCollection;

export function getTraceItemTagCollection(
  result: AttributeType[],
  type: TraceItemAttributeType[]
): TraceItemTagCollections;

export function getTraceItemTagCollection(
  result: AttributeType[],
  type?: TraceItemAttributeKeysOptions['type']
) {
  const stringAttributes: TagCollection = {};
  const numberAttributes: TagCollection = {};
  const booleanAttributes: TagCollection = {};

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

    const requestedType = Array.isArray(type) ? undefined : type;
    const attributeType =
      requestedType === undefined || requestedType === attribute.attributeType
        ? attribute.attributeType
        : undefined;

    if (attributeType === 'string') {
      stringAttributes[attribute.key] = {
        key: attribute.key,
        name: attribute.name,
        kind: FieldKind.TAG,
        secondaryAliases: attribute?.secondaryAliases ?? [],
      };
    } else if (attributeType === 'number') {
      numberAttributes[attribute.key] = {
        key: attribute.key,
        name: attribute.name,
        kind: FieldKind.MEASUREMENT,
        secondaryAliases: attribute?.secondaryAliases ?? [],
      };
    } else if (attributeType === 'boolean') {
      booleanAttributes[attribute.key] = {
        key: attribute.key,
        name: attribute.name,
        kind: FieldKind.BOOLEAN,
        secondaryAliases: attribute?.secondaryAliases ?? [],
      };
    }
  }

  if (type === 'number') {
    return numberAttributes;
  }

  if (type === 'boolean') {
    return booleanAttributes;
  }

  if (type === 'string') {
    return stringAttributes;
  }

  return {
    stringAttributes,
    numberAttributes,
    booleanAttributes,
  };
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

/**
 * We want to remove attributes that have tag wrapper in some cases (eg. datascrubbing attribute field)
 * As they are not valid in some contexts (eg. relay event selectors).
 */
export function elideTagBasedAttributes(attributes: TagCollection) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !key.startsWith('tags['))
  );
}
