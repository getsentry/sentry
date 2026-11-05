import type {UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {Event, Frame} from 'sentry/types/event';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';

import {buildStacktraceLinkQuery} from './useStacktraceLink';

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

const sourceContextOptions = (
  orgSlug: string,
  projectSlug: string | undefined,
  query: ReturnType<typeof buildStacktraceLinkQuery>
) =>
  apiOptions.as<SourceContextResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/stacktrace-source-context/',
    {
      path: {
        organizationIdOrSlug: orgSlug,
        projectIdOrSlug: projectSlug!,
      },
      query,
      staleTime: Infinity,
    }
  );

export function useSourceContext(
  {event, frame, orgSlug, projectSlug}: UseSourceContextProps,
  options: Partial<
    Omit<
      UseQueryOptions<
        ApiResponse<SourceContextResponse>,
        Error,
        SourceContextResponse,
        ApiQueryKey
      >,
      'queryKey' | 'queryFn' | 'select'
    >
  > = {}
) {
  const query = {
    ...buildStacktraceLinkQuery(event, frame),
    file: (frame.filename || frame.absPath)!,
  };
  return useQuery({
    ...sourceContextOptions(orgSlug, projectSlug, query),
    retry: false,
    ...options,
  });
}
