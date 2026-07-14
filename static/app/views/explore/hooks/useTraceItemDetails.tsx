import {useCallback, useRef, useState} from 'react';
import {useHover} from '@react-aria/interactions';
import {captureException} from '@sentry/react';
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {Meta} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {normalizeTimestampToSeconds} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useProjects} from 'sentry/utils/useProjects';
import type {TraceItemDataset} from 'sentry/views/explore/types';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

interface UseTraceItemDetailsProps {
  /**
   * Every trace item belongs to a project.
   */
  projectId: string;
  /**
   * Sets referrer parameter in the API Payload. Set of allowed referrers are defined
   * as ALLOWED_EVENTS_REFERRERS on the backend.
   */
  referrer: string;
  /**
   * Every trace item belongs to a trace.
   */
  traceId: string;
  /**
   * The trace item ID representing an EAP trace item.
   */
  traceItemId: string;
  /**
   * The trace item type supported by the endpoint, currently only supports LOGS.
   */
  traceItemType: TraceItemDataset;
  /**
   * Alias for `enabled` in react-query.
   */
  enabled?: boolean;
  /**
   * Optional Unix timestamp in seconds to disambiguate trace item lookup.
   */
  timestamp?: number | null;
}

export type TraceItemAttributeMeta = Pick<Meta, 'len' | 'rem'>;
interface TraceItemDetailsMetaRecord {
  meta: {
    value: {
      '': TraceItemAttributeMeta;
    };
  };
}

export type TraceItemDetailsMeta = Record<string, TraceItemDetailsMetaRecord>;

export interface TraceItemDetailsResponse {
  attributes: TraceItemResponseAttribute[];
  itemId: string;
  meta: TraceItemDetailsMeta;
  timestamp: string;
  links?: TraceItemResponseLink[];
}

// Span links are stored as JSON-encoded attributes in EAP for now. The backend
// decodes the JSON for us. Since links are so structurally similar to spans, the types are similar as well.
export type TraceItemResponseLink = {
  itemId: string;
  sampled: boolean;
  traceId: string;
  attributes?: TraceItemResponseAttribute[];
};

type TraceItemDetailsUrlParams = {
  organizationSlug: string;
  projectSlug: string;
  traceItemId: string;
};

type TraceItemDetailsQueryParams = {
  referrer: string;
  traceId: string;
  traceItemType: TraceItemDataset;
  end?: string;
  start?: string;
  statsPeriod?: string | null;
  timestamp?: number;
  utc?: string;
};

type TraceItemDetailsApiQuery = {
  item_type: TraceItemDataset;
  referrer: string;
  trace_id: string;
  end?: string;
  start?: string;
  statsPeriod?: string | null;
  timestamp?: number;
  utc?: string;
};

export type TraceItemResponseAttribute =
  | {name: string; type: 'str'; value: string}
  | {name: string; type: 'int'; value: number}
  | {name: string; type: 'float'; value: number}
  | {name: string; type: 'bool'; value: boolean};

/**
 * Query hook fetching trace item details in EAP.
 */
export function useTraceItemDetails(props: UseTraceItemDetailsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {fetching} = useProjects();
  const project = useProjectFromId({project_id: props.projectId});
  const enabled = (props.enabled ?? true) && !!project;

  // Only capture exception if the project is not found and the query is enabled.
  if ((props.enabled ?? true) && !project && !fetching) {
    captureException(
      new Error(`Project "${props.projectId}" not found in useTraceItemDetails`)
    );
  }

  const timeQueryParams = defined(props.timestamp)
    ? {timestamp: normalizeTimestampToSeconds(props.timestamp)}
    : normalizeDateTimeParams(selection.datetime);

  const result = useQuery({
    ...traceItemDetailsApiOptions({
      organizationSlug: organization.slug,
      projectSlug: project?.slug ?? '',
      traceItemId: props.traceItemId,
      traceItemType: props.traceItemType,
      referrer: props.referrer,
      traceId: props.traceId,
      ...timeQueryParams,
    }),
    enabled,
    retry: shouldRetryHandler,
    retryDelay: getRetryDelay,
  });

  return result;
}

function traceItemDetailsApiOptions({
  organizationSlug,
  projectSlug,
  traceItemId,
  traceItemType,
  referrer,
  traceId,
  timestamp,
  statsPeriod,
  start,
  end,
  utc,
}: TraceItemDetailsUrlParams & TraceItemDetailsQueryParams) {
  const timeQuery: Partial<TraceItemDetailsApiQuery> =
    timestamp === undefined
      ? {
          ...(defined(statsPeriod) ? {statsPeriod} : {}),
          ...(defined(start) ? {start} : {}),
          ...(defined(end) ? {end} : {}),
          ...(defined(utc) ? {utc} : {}),
        }
      : {timestamp};

  return apiOptions.as<TraceItemDetailsResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/trace-items/$itemId/',
    {
      path:
        organizationSlug && projectSlug && traceItemId
          ? {
              organizationIdOrSlug: organizationSlug,
              projectIdOrSlug: projectSlug,
              itemId: traceItemId,
            }
          : skipToken,
      query: {
        item_type: traceItemType,
        referrer,
        trace_id: traceId,
        ...timeQuery,
      },
      staleTime: Infinity,
    }
  );
}

function useTraceItemDetailsPrefetch({
  traceItemId,
  projectId,
  traceId,
  traceItemType,
  referrer,
  timestamp,
}: UseTraceItemDetailsProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const project = useProjectFromId({project_id: projectId});
  const projectRef = useRef(project);
  projectRef.current = project;
  const queryClient = useQueryClient();
  const [traceItemMeta, setTraceItemMeta] = useState<TraceItemDetailsMeta | undefined>();
  const [traceItemAttributes, setTraceItemAttributes] = useState<
    TraceItemResponseAttribute[] | undefined
  >();

  const prefetch = useCallback(() => {
    const currentProject = projectRef.current;
    if (!currentProject?.slug) {
      return;
    }
    const timeQueryParams = defined(timestamp)
      ? {timestamp: normalizeTimestampToSeconds(timestamp)}
      : normalizeDateTimeParams(selection.datetime);
    const options = traceItemDetailsApiOptions({
      organizationSlug: organization.slug,
      projectSlug: currentProject.slug,
      traceItemId,
      traceItemType,
      referrer,
      traceId,
      ...timeQueryParams,
    });
    queryClient.fetchQuery(options).then(
      response => {
        setTraceItemMeta(response?.json?.meta);
        setTraceItemAttributes(response?.json?.attributes);
      },
      () => {}
    );
  }, [
    organization.slug,
    queryClient,
    referrer,
    selection.datetime,
    timestamp,
    traceId,
    traceItemId,
    traceItemType,
  ]);

  return {prefetch, project, traceItemMeta, traceItemAttributes};
}

export function usePrefetchTraceItemDetailsOnHover({
  traceItemId,
  projectId,
  traceId,
  traceItemType,
  referrer,
  timestamp,
  hoverPrefetchDisabled,
  sharedHoverTimeoutRef,
  timeout,
}: UseTraceItemDetailsProps & {
  /**
   * A ref to a shared timeout so multiple hover events can be handled
   * without creating multiple timeouts and firing multiple prefetches.
   */
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  /**
   * Custom timeout for the prefetched item.
   */
  timeout: number;
  /**
   * Whether the hover prefetch should be disabled.
   */
  hoverPrefetchDisabled?: boolean;
}) {
  const {prefetch, project, traceItemMeta, traceItemAttributes} =
    useTraceItemDetailsPrefetch({
      traceItemId,
      projectId,
      traceId,
      traceItemType,
      referrer,
      timestamp,
    });

  const {hoverProps} = useHover({
    onHoverStart: () => {
      if (sharedHoverTimeoutRef.current) {
        clearTimeout(sharedHoverTimeoutRef.current);
      }
      sharedHoverTimeoutRef.current = setTimeout(prefetch, timeout);
    },
    onHoverEnd: () => {
      if (sharedHoverTimeoutRef.current) {
        clearTimeout(sharedHoverTimeoutRef.current);
      }
    },
    isDisabled: hoverPrefetchDisabled,
  });

  return {
    hoverProps,
    prefetch,
    isProjectReady: Boolean(project?.slug),
    traceItemMeta,
    traceItemAttributes,
  };
}

export function usePrefetchTraceItemDetailsOnMount({
  prefetch,
  enabled,
  isProjectReady,
}: {
  isProjectReady: boolean;
  prefetch: () => void;
  enabled?: boolean;
}) {
  const hasPrefetched = useRef(false);
  if (enabled && isProjectReady && !hasPrefetched.current) {
    hasPrefetched.current = true;
    prefetch();
  }
}
