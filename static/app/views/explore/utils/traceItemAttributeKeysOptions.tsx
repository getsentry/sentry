import {useCallback} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

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

function makeTraceItemAttributeKeysQueryOptions({
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

interface TraceItemAttributeKeysOptions {
  traceItemType: TraceItemDataset;
  type: 'string' | 'number' | 'boolean';
  projectIds?: Array<string | number>;
  projects?: Project[];
  query?: string;
  search?: string;
  staleTime?: number;
}

export function useTraceItemAttributeKeysOptions() {
  const {selection} = usePageFilters();
  const organization = useOrganization();

  return useCallback(
    ({
      staleTime = 0,
      traceItemType,
      type,
      projects,
      projectIds: explicitProjectIds,
      query,
      search,
    }: TraceItemAttributeKeysOptions) => {
      const projectIds =
        explicitProjectIds ??
        (defined(projects) ? projects.map(project => project.id) : selection.projects);

      const options = makeTraceItemAttributeKeysQueryOptions({
        datetime: selection.datetime,
        traceItemType,
        type,
        projectIds,
        query,
        search,
      });

      return apiOptions.as<Tag[]>()(
        '/organizations/$organizationIdOrSlug/trace-items/attributes/',
        {
          path: {organizationIdOrSlug: organization.slug},
          staleTime,
          query: options,
        }
      );
    },
    [organization.slug, selection.datetime, selection.projects]
  );
}

export function selectTraceItemTagCollection(
  type: TraceItemAttributeKeysOptions['type']
) {
  return function (data: ApiResponse<Tag[]>) {
    const {json} = selectJsonWithHeaders(data);
    return getTraceItemTagCollection(json, type);
  };
}

export function getTraceItemTagCollection(
  result: Tag[],
  type: TraceItemAttributeKeysOptions['type']
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

/**
 * We want to remove attributes that have tag wrapper in some cases (eg. datascrubbing attribute field)
 * As they are not valid in some contexts (eg. relay event selectors).
 */
export function elideTagBasedAttributes(attributes: TagCollection) {
  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => !key.startsWith('tags['))
  );
}
