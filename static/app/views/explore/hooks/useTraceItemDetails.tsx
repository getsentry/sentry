import {useHover} from '@react-aria/interactions';
import {captureException} from '@sentry/react';

import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import {
  type ApiQueryKey,
  fetchDataQuery,
  useApiQuery,
  useQueryClient,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectFromId from 'sentry/utils/useProjectFromId';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

const DEFAULT_HOVER_TIMEOUT = 200;

/**
 * ProjectTraceItemDetailsEndpoint currently only supports ourlogs dataset
 * TODO: Add SPANS_EAP once the backend supports it.
 */
type EAPDataset = DiscoverDatasets.OURLOGS;

export interface UseTraceItemDetailsProps {
  /**
   * Trace items are only supported by EAP.
   */
  dataset: EAPDataset;
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
   * Alias for `enabled` in react-query.
   */
  enabled?: boolean;
}

interface TraceItemDetailsResponse {
  attributes: TraceItemResponseAttribute[];
  itemId: string;
  timestamp: string;
}

type TraceItemDetailsUrlParams = {
  organizationSlug: string;
  projectSlug: string;
  traceItemId: string;
};

type TraceItemDetailsQueryParams = {
  dataset: EAPDataset;
  referrer: string;
  traceId: string;
};

export type TraceItemResponseAttribute =
  | {type: 'str'; value: string}
  | {type: 'int'; value: number}
  | {type: 'float'; value: number}
  | {type: 'bool'; value: boolean};

/**
 * Query hook fetching trace item details in EAP.
 */
export function useTraceItemDetails(props: UseTraceItemDetailsProps) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: props.projectId});
  const {isReady: pageFiltersReady} = usePageFilters();
  const enabled = pageFiltersReady && (props.enabled ?? true) && !!project;

  if (!project) {
    captureException(
      new Error(`Project "${props.projectId}" not found in useTraceItemDetails`)
    );
  }

  const queryParams: TraceItemDetailsQueryParams = {
    referrer: props.referrer,
    dataset: props.dataset,
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
      enabled: enabled && pageFiltersReady,
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
    dataset: queryParams.dataset,
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
  dataset,
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
              dataset,
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
