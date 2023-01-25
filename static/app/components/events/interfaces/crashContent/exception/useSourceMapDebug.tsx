import uniqBy from 'lodash/uniqBy';

import type {ExceptionValue, Frame} from 'sentry/types';
import {defined} from 'sentry/utils';
import {QueryKey, useQuery, UseQueryOptions} from 'sentry/utils/queryClient';

export interface SourceMapDebugResponse {
  errors: SourceMapProcessingIssueResponse[];
}

interface SourceMapProcessingIssueResponse {
  message: string;
  type: SourceMapProcessingIssueType;
}

export enum SourceMapProcessingIssueType {
  UNKNOWN_ERROR = 'unknown_error',
  MISSING_RELEASE = 'no_release_on_event',
  MISSING_USER_AGENT = 'no_user_agent_on_release',
  MISSING_SOURCEMAPS = 'no_sourcemaps_on_release',
  URL_NOT_VALID = 'url_not_valid',
}

const sourceMapDebugQuery = ({
  orgSlug,
  projectSlug,
  eventId,
  frameIdx,
  exceptionIdx,
}: UseSourceMapDebugProps): QueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/source-map-debug/`,
  {
    query: {
      frame_idx: `${frameIdx}`,
      exception_idx: `${exceptionIdx}`,
    },
  },
];

interface UseSourceMapDebugProps {
  eventId?: string;
  exceptionIdx?: number;
  frameIdx?: number;
  orgSlug?: string;
  projectSlug?: string | undefined;
}

export type StacktraceFilenameTuple = [filename: string, query: UseSourceMapDebugProps];

export function useSourceMapDebug(
  props?: UseSourceMapDebugProps,
  options: Partial<UseQueryOptions<SourceMapDebugResponse>> = {}
) {
  return useQuery<SourceMapDebugResponse>(sourceMapDebugQuery(props ?? {}), {
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    notifyOnChangeProps: ['data'],
    ...options,
    enabled: !!options.enabled && defined(props),
  });
}

// TODO
const ALLOWED_PLATFORMS = ['javascript', 'node', 'react-native'];

/**
 * Returns an array of unique filenames and the first frame they appear in.
 * Filters out non inApp frames and frames without a line number.
 * Limited to only the first 3 unique filenames.
 */
export function getUnqiueFilesFromExcption(
  excValues: ExceptionValue[],
  platform: string,
  props: Omit<UseSourceMapDebugProps, 'frameIdx' | 'exceptionIdx'>
): StacktraceFilenameTuple[] {
  // Check we have all required props and platform is supported
  if (
    !props.orgSlug ||
    !props.projectSlug ||
    !props.eventId ||
    !ALLOWED_PLATFORMS.includes(platform)
  ) {
    return [];
  }

  // Not using .at(-1) because we need to use the index later
  const exceptionIdx = excValues.length - 1;
  const fileFrame = (excValues[exceptionIdx]?.stacktrace?.frames ?? [])
    // Get the frame numbers before filtering
    .map<[Frame, number]>((frame, idx) => [frame, idx])
    .filter(
      ([frame]) =>
        frame.inApp &&
        frame.filename &&
        // Line number might not work for non-javascript languages
        defined(frame.lineNo)
    )
    .map<StacktraceFilenameTuple>(([frame, idx]) => [
      frame.filename!,
      {...props, frameIdx: idx, exceptionIdx},
    ]);

  // Return only the first 3 unique filenames
  // TODO: reverse only applies to newest first
  return uniqBy(fileFrame.reverse(), ([filename]) => filename).slice(0, 3);
}
