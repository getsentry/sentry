import {useState} from 'react';
import {useHover} from '@react-aria/interactions';
import {captureException} from '@sentry/react';
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query';

import type {Meta} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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
  const {fetching} = useProjects();
  const project = useProjectFromId({project_id: props.projectId});
  const enabled = (props.enabled ?? true) && !!project;

  // Only capture exception if the project is not found and the query is enabled.
  if ((props.enabled ?? true) && !project && !fetching) {
    captureException(
      new Error(`Project "${props.projectId}" not found in useTraceItemDetails`)
    );
  }

  const result = useQuery({
    ...traceItemDetailsApiOptions({
      organizationSlug: organization.slug,
      projectSlug: project?.slug ?? '',
      traceItemId: props.traceItemId,
      traceItemType: props.traceItemType,
      referrer: props.referrer,
      traceId: props.traceId,
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
}: TraceItemDetailsUrlParams & TraceItemDetailsQueryParams) {
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
      },
      staleTime: Infinity,
    }
  );
}

export function usePrefetchTraceItemDetailsOnHover({
  traceItemId,
  projectId,
  traceId,
  traceItemType,
  referrer,
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
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});
  const queryClient = useQueryClient();
  const [traceItemMeta, setTraceItemMeta] = useState<TraceItemDetailsMeta | undefined>();

  const {hoverProps} = useHover({
    onHoverStart: () => {
      if (sharedHoverTimeoutRef.current) {
        clearTimeout(sharedHoverTimeoutRef.current);
      }
      sharedHoverTimeoutRef.current = setTimeout(() => {
        const options = traceItemDetailsApiOptions({
          organizationSlug: organization.slug,
          projectSlug: project?.slug ?? '',
          traceItemId,
          traceItemType,
          referrer,
          traceId,
        });
        queryClient.fetchQuery(options).then(response => {
          setTraceItemMeta(response?.json?.meta);
        });
      }, timeout);
    },
    onHoverEnd: () => {
      if (sharedHoverTimeoutRef.current) {
        clearTimeout(sharedHoverTimeoutRef.current);
      }
    },
    isDisabled: hoverPrefetchDisabled,
  });

  return {hoverProps, traceItemMeta};
}
