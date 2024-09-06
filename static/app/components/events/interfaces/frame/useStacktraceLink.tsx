import type {Event, Frame} from 'sentry/types/event';
import type {StacktraceLinkResult} from 'sentry/types/integrations';
import type {ApiQueryKey, UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

interface UseStacktraceLinkProps {
  event: Partial<Pick<Event, 'platform' | 'release' | 'sdk' | 'groupID'>>;
  frame: Partial<
    Pick<Frame, 'absPath' | 'filename' | 'function' | 'module' | 'package' | 'lineNo'>
  >;
  orgSlug: string;
  projectSlug: string | undefined;
}

interface StacktraceLinkQuery {
  file: string;
  lineNo: number;
  platform: string;
  absPath?: string;
  commitId?: string;
  groupId?: string;
  module?: string;
  package?: string;
  sdkName?: string;
}

export function buildStacktraceLinkQuery(
  event: UseStacktraceLinkProps['event'],
  frame: UseStacktraceLinkProps['frame']
): StacktraceLinkQuery {
  const query = {
    file: frame.filename!,
    platform: event.platform!,
    lineNo: frame.lineNo!,
    groupId: event.groupID,
    commitId: event.release?.lastCommit?.id,
    ...(event.sdk?.name && {sdkName: event.sdk.name}),
    ...(frame.absPath && {absPath: frame.absPath}),
    ...(frame.module && {module: frame.module}),
    ...(frame.package && {package: frame.package}),
  };
  return query;
}

const stacktraceLinkQueryKey = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: StacktraceLinkQuery
): ApiQueryKey => [`/projects/${orgSlug}/${projectSlug}/stacktrace-link/`, {query}];

function useStacktraceLink(
  {event, frame, orgSlug, projectSlug}: UseStacktraceLinkProps,
  options: Partial<UseApiQueryOptions<StacktraceLinkResult>> = {}
) {
  const query = buildStacktraceLinkQuery(event, frame);
  return useApiQuery<StacktraceLinkResult>(
    stacktraceLinkQueryKey(orgSlug, projectSlug, query),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}
export default useStacktraceLink;
