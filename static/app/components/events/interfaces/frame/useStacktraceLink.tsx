import type {Event, Frame, StacktraceLinkResult} from 'sentry/types';
import {QueryKey, useQuery} from 'sentry/utils/queryClient';

interface UseStacktraceLinkProps {
  event: Event;
  frame: Frame;
  orgSlug: string;
  projectSlug: string | undefined;
}

const stacktraceLinkQueryKey = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: any
): QueryKey => [`/projects/${orgSlug}/${projectSlug}/stacktrace-link/`, {query}];

function UseStacktraceLink({event, frame, orgSlug, projectSlug}: UseStacktraceLinkProps) {
  const query = {
    file: frame.filename,
    platform: event.platform,
    commitId: event.release?.lastCommit?.id,
    ...(event.sdk?.name && {sdkName: event.sdk.name}),
    ...(frame.absPath && {absPath: frame.absPath}),
    ...(frame.module && {module: frame.module}),
    ...(frame.package && {package: frame.package}),
  };

  return useQuery<StacktraceLinkResult>(
    stacktraceLinkQueryKey(orgSlug, projectSlug, query),
    {
      staleTime: Infinity,
      retry: false,
    }
  );
}
export default UseStacktraceLink;
