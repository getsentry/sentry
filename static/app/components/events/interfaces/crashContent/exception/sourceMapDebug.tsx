import type {Event} from 'sentry/types';
import {QueryKey, useQuery, UseQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseSourcemapDebugProps {
  event: Event;
  orgSlug: string;
  projectSlug: string | undefined;
}

interface SourcemapDebugResponse {
  errors: SourceMapProcessingIssueResponse[];
}

enum SourceMapProcessingIssueType {
  UNKNOWN_ERROR = 'unknown_error',
  MISSING_RELEASE = 'no_release_on_event',
  MISSING_USER_AGENT = 'no_user_agent_on_release',
  MISSING_SOURCEMAPS = 'no_sourcemaps_on_release',
  URL_NOT_VALID = 'url_not_valid',
}

interface SourceMapProcessingIssueResponse {
  data: {message: string; type: SourceMapProcessingIssueType};
  message: string;
  type: string;
}

const sourceMapDebugQuery = (
  orgSlug: string,
  projectSlug: string | undefined,
  eventId: Event['id']
): QueryKey => [`/${orgSlug}/${projectSlug}/events/${eventId}/source-map-debug/`];

function useSourceMapDebug(
  {event, orgSlug, projectSlug}: UseSourcemapDebugProps,
  options: Partial<UseQueryOptions<SourcemapDebugResponse>> = {}
) {
  return useQuery<SourcemapDebugResponse>(
    sourceMapDebugQuery(orgSlug, projectSlug, event.id),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}

interface SourcemapDebugProps {
  event: Event;
  projectSlug: string | undefined;
}

export function SourceMapDebug({event, projectSlug}: SourcemapDebugProps) {
  const organization = useOrganization();
  const enabled = organization.features.includes('source-maps-cta');
  const {data, isLoading} = useSourceMapDebug(
    {event, orgSlug: organization.slug, projectSlug},
    {enabled}
  );

  if (isLoading || !enabled) {
    return null;
  }

  return <div>{data?.errors[0]?.message}</div>;
}
