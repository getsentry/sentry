import {useQuery} from '@tanstack/react-query';

import type {Event, Frame} from 'sentry/types/event';
import type {StacktraceLinkResult} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';

import {isUnlinkableFilename} from './utils';

interface UseStacktraceLinkProps {
  event: Partial<Pick<Event, 'platform' | 'release' | 'sdk' | 'groupID'>>;
  frame: Partial<
    Pick<Frame, 'absPath' | 'filename' | 'function' | 'module' | 'package' | 'lineNo'>
  >;
  orgSlug: string;
  projectSlug: string | undefined;
}

type StacktraceLinkQuery = {
  file: string;
  lineNo: number;
  platform: string;
  absPath?: string;
  commitId?: string;
  groupId?: string;
  module?: string;
  package?: string;
  sdkName?: string;
};

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

const stacktraceLinkOptions = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: StacktraceLinkQuery
) =>
  apiOptions.as<StacktraceLinkResult>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/stacktrace-link/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug!,
      },
      query,
      staleTime: Infinity,
    }
  );

export function useStacktraceLink(
  {event, frame, orgSlug, projectSlug}: UseStacktraceLinkProps,
  options: {enabled?: boolean} = {}
) {
  const query = buildStacktraceLinkQuery(event, frame);
  return useQuery({
    ...stacktraceLinkOptions(orgSlug, projectSlug, query),
    retry: false,
    ...options,
    enabled: (options.enabled ?? true) && !isUnlinkableFilename(frame.filename ?? ''),
  });
}
