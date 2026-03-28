import {buildStacktraceLinkQuery} from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import type {Event, Frame} from 'sentry/types/event';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

export interface SourceContextResponse {
  context: Array<[number, string]>;
  error: string | null;
  sourceUrl: string | null;
}

interface UseSourceContextProps {
  event: Partial<Pick<Event, 'platform' | 'release' | 'sdk' | 'groupID'>>;
  frame: Partial<
    Pick<Frame, 'absPath' | 'filename' | 'function' | 'module' | 'package' | 'lineNo'>
  >;
  orgSlug: string;
  projectSlug: string | undefined;
}

const sourceContextQueryKey = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: ReturnType<typeof buildStacktraceLinkQuery>
): ApiQueryKey => [
  getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/stacktrace-source-context/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug!,
      },
    }
  ),
  {query},
];

export function useSourceContext(
  {event, frame, orgSlug, projectSlug}: UseSourceContextProps,
  options: Partial<UseApiQueryOptions<SourceContextResponse>> = {}
) {
  const query = {
    ...buildStacktraceLinkQuery(event, frame),
    file: (frame.filename || frame.absPath)!,
  };
  return useApiQuery<SourceContextResponse>(
    sourceContextQueryKey(orgSlug, projectSlug, query),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}
