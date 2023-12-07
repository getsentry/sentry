import type {Event, Frame, StacktraceLinkResult} from 'sentry/types';
import {ApiQueryKey, useApiQuery, UseApiQueryOptions} from 'sentry/utils/queryClient';

interface UseStacktraceLinkProps {
  event: Partial<Pick<Event, 'platform' | 'release' | 'sdk'>>;
  frame: Partial<
    Pick<Frame, 'absPath' | 'filename' | 'function' | 'module' | 'package' | 'lineNo'>
  >;
  orgSlug: string;
  projectSlug: string | undefined;
}

const stacktraceLinkQueryKey = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: any
): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/stacktrace-link/`, {query}];

function useStacktraceLink(
  {event, frame, orgSlug, projectSlug}: UseStacktraceLinkProps,
  options: Partial<UseApiQueryOptions<StacktraceLinkResult>> = {}
) {
  const query = {
    file: frame.filename,
    platform: event.platform,
    commitId: event.release?.lastCommit?.id,
    ...(event.sdk?.name && {sdkName: event.sdk.name}),
    ...(frame.absPath && {absPath: frame.absPath}),
    ...(frame.module && {module: frame.module}),
    ...(frame.package && {package: frame.package}),
    lineNo: frame.lineNo,
  };

  return useApiQuery<StacktraceLinkResult>(
    stacktraceLinkQueryKey(orgSlug, projectSlug, query),
    {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      ...options,
    }
  );
}
export default useStacktraceLink;
