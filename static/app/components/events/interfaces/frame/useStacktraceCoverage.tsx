import {buildStacktraceLinkQuery} from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import type {Event, Frame} from 'sentry/types/event';
import type {CodecovResponse} from 'sentry/types/integrations';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

interface UseStacktraceCoverageProps {
  event: Partial<Pick<Event, 'platform' | 'release' | 'sdk' | 'groupID'>>;
  frame: Partial<
    Pick<Frame, 'absPath' | 'filename' | 'function' | 'module' | 'package' | 'lineNo'>
  >;
  orgSlug: string;
  projectSlug: string | undefined;
}

const stacktraceCoverageQueryKey = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: ReturnType<typeof buildStacktraceLinkQuery>
): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/stacktrace-coverage/`, {query}];

export function useStacktraceCoverage(
  {event, frame, orgSlug, projectSlug}: UseStacktraceCoverageProps,
  options: Partial<UseApiQueryOptions<CodecovResponse>> = {}
) {
  const query = buildStacktraceLinkQuery(event, frame);
  return useApiQuery<CodecovResponse>(
    stacktraceCoverageQueryKey(orgSlug, projectSlug, query),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}
