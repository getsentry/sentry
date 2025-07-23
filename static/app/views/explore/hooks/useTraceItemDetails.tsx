import {useHover} from '@react-aria/interactions';
import {captureException} from '@sentry/react';

import {
  type ApiQueryKey,
  fetchDataQuery,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import type {TraceItemDataset} from 'sentry/views/explore/types';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

const DEFAULT_HOVER_TIMEOUT = 200;

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
}

export interface TraceItemDetailsResponse {
  attributes: TraceItemResponseAttribute[];
  itemId: string;
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
  const project = useProjectFromId({project_id: props.projectId});
  const enabled = (props.enabled ?? true) && !!project;

  // Only capture exception if the project is not found and the query is enabled.
  if ((props.enabled ?? true) && !project) {
    captureException(
      new Error(`Project "${props.projectId}" not found in useTraceItemDetails`)
    );
  }

  const queryParams: TraceItemDetailsQueryParams = {
    referrer: props.referrer,
    traceItemType: props.traceItemType,
    traceId: props.traceId,
  };

  const result = useApiQuery<TraceItemDetailsResponse>(
    traceItemDetailsQueryKey({
      urlParams: {
        organizationSlug: organization.slug,
        projectSlug: project?.slug ?? '',
        traceItemId: props.traceItemId,
      },
      queryParams,
    }),
    {
      enabled,
      retry: shouldRetryHandler,
      retryDelay: getRetryDelay,
      staleTime: Infinity,
    }
  );

  return result;
}

function traceItemDetailsQueryKey({
  urlParams,
  queryParams,
}: {
  queryParams: TraceItemDetailsQueryParams;
  urlParams: TraceItemDetailsUrlParams;
}): ApiQueryKey {
  const query: Record<string, string | string[]> = {
    item_type: queryParams.traceItemType,
    referrer: queryParams.referrer,
    trace_id: queryParams.traceId,
  };

  return [
    `/projects/${urlParams.organizationSlug}/${urlParams.projectSlug}/trace-items/${urlParams.traceItemId}/`,
    {query},
  ];
}

export function usePrefetchTraceItemDetailsOnHover({
  traceItemId,
  projectId,
  traceId,
  traceItemType,
  referrer,
  hoverPrefetchDisabled,
  sharedHoverTimeoutRef,
}: UseTraceItemDetailsProps & {
  /**
   * A ref to a shared timeout so multiple hover events can be handled
   * without creating multiple timeouts and firing multiple prefetches.
   */
  sharedHoverTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  /**
   * Whether the hover prefetch should be disabled.
   */
  hoverPrefetchDisabled?: boolean;
}) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});
  const queryClient = useQueryClient();

  const {hoverProps} = useHover({
    onHoverStart: () => {
      if (sharedHoverTimeoutRef.current) {
        clearTimeout(sharedHoverTimeoutRef.current);
      }
      sharedHoverTimeoutRef.current = setTimeout(() => {
        queryClient.prefetchQuery({
          queryKey: traceItemDetailsQueryKey({
            urlParams: {
              organizationSlug: organization.slug,
              projectSlug: project?.slug ?? '',
              traceItemId,
            },
            queryParams: {
              traceItemType,
              referrer,
              traceId,
            },
          }),
          queryFn: fetchDataQuery,
          staleTime: 30_000,
        });
      }, DEFAULT_HOVER_TIMEOUT);
    },
    onHoverEnd: () => {
      if (sharedHoverTimeoutRef.current) {
        clearTimeout(sharedHoverTimeoutRef.current);
      }
    },
    isDisabled: hoverPrefetchDisabled,
  });

  return hoverProps;
}
