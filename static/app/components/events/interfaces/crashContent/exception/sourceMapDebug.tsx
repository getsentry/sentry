import uniqBy from 'lodash/uniqBy';

import type {Event, ExceptionValue} from 'sentry/types';
import {defined} from 'sentry/utils';
import {QueryKey, useQuery, UseQueryOptions} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface UseSourcemapDebugProps {
  event: Event;
  exceptionIdx: number;
  frameIdx: number;
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

type StacktraceFilenameTuple = [filename: string, frameIdx: number, exceptionIdx: number];

/**
 * Returns an array of unique filenames and the first frame they appear in
 * Filters out non inApp frames and frames without a line number
 */
export function getUnqiueFilesFromExcption(
  excValues: ExceptionValue[]
): StacktraceFilenameTuple[] {
  // Not using .at(-1) because we need to use the index later
  const exceptionIdx = excValues.length - 1;
  const fileFrame = (excValues[exceptionIdx]?.stacktrace?.frames ?? [])
    .filter(
      frame =>
        frame.inApp &&
        frame.filename &&
        // Line number might not work for non-javascript languages
        defined(frame.lineNo)
    )
    .map<StacktraceFilenameTuple>((frame, idx) => [frame.filename!, idx, exceptionIdx]);

  return uniqBy(fileFrame, ([filename]) => filename);
}

const sourceMapDebugQuery = (
  orgSlug: string,
  projectSlug: string | undefined,
  eventId: Event['id'],
  query: Record<string, string>
): QueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/source-map-debug/`,
  {query},
];

function useSourceMapDebug(
  {event, orgSlug, projectSlug, frameIdx}: UseSourcemapDebugProps,
  options: Partial<UseQueryOptions<SourcemapDebugResponse>> = {}
) {
  return useQuery<SourcemapDebugResponse>(
    sourceMapDebugQuery(orgSlug, projectSlug, event.id, {
      frame_idx: `${frameIdx}`,
      exception_idx: `${frameIdx}`,
    }),
    {
      staleTime: Infinity,
      retry: false,
      ...options,
    }
  );
}

interface SourcemapDebugProps {
  debugFrames: StacktraceFilenameTuple[];
  event: Event;
  projectSlug: string | undefined;
}

export function SourceMapDebug({event, projectSlug, debugFrames}: SourcemapDebugProps) {
  const organization = useOrganization();
  const enabled = organization.features.includes('source-maps-cta');
  // TODO: Support multiple frames
  const [firstFrame] = debugFrames;
  const {data, isLoading} = useSourceMapDebug(
    {
      event,
      orgSlug: organization.slug,
      projectSlug,
      frameIdx: firstFrame[1],
      exceptionIdx: firstFrame[2],
    },
    {enabled: enabled && defined(firstFrame)}
  );

  if (isLoading || !enabled) {
    return null;
  }

  return <div>{data?.errors[0]?.message}</div>;
}
