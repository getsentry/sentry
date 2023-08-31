import flatten from 'lodash/flatten';
import uniqBy from 'lodash/uniqBy';

import type {ExceptionValue, Frame, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  ApiQueryKey,
  useApiQuery,
  UseApiQueryOptions,
  useQueries,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

import {isFrameFilenamePathlike, sourceMapSdkDocsMap} from './utils';

interface BaseSourceMapDebugError {
  message: string;
  type: SourceMapProcessingIssueType;
}

interface UnknownErrorDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.UNKNOWN_ERROR;
}
interface MissingReleaseDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.MISSING_RELEASE;
}
interface MissingSourcemapsDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.MISSING_SOURCEMAPS;
}
interface UrlNotValidDebugError extends BaseSourceMapDebugError {
  data: {absPath: string};
  type: SourceMapProcessingIssueType.URL_NOT_VALID;
}
interface PartialMatchDebugError extends BaseSourceMapDebugError {
  data: {absPath: string; partialMatchPath: string; urlPrefix: string};
  type: SourceMapProcessingIssueType.PARTIAL_MATCH;
}
interface DistMismatchDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.DIST_MISMATCH;
}
interface SourcemapNotFoundDebugError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.SOURCEMAP_NOT_FOUND;
}
interface NoURLMatchDebugError extends BaseSourceMapDebugError {
  data: {absPath: string};
  type: SourceMapProcessingIssueType.NO_URL_MATCH;
}
interface DebugIdNotSetUpError extends BaseSourceMapDebugError {
  type: SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS;
}

export type SourceMapDebugError =
  | UnknownErrorDebugError
  | MissingReleaseDebugError
  | MissingSourcemapsDebugError
  | UrlNotValidDebugError
  | PartialMatchDebugError
  | DistMismatchDebugError
  | SourcemapNotFoundDebugError
  | NoURLMatchDebugError
  | DebugIdNotSetUpError;

export interface SourceMapDebugResponse {
  errors: SourceMapDebugError[];
}

export enum SourceMapProcessingIssueType {
  UNKNOWN_ERROR = 'unknown_error',
  MISSING_RELEASE = 'no_release_on_event',
  MISSING_SOURCEMAPS = 'no_sourcemaps_on_release',
  URL_NOT_VALID = 'url_not_valid',
  NO_URL_MATCH = 'no_url_match',
  PARTIAL_MATCH = 'partial_match',
  DIST_MISMATCH = 'dist_mismatch',
  SOURCEMAP_NOT_FOUND = 'sourcemap_not_found',
  DEBUG_ID_NO_SOURCEMAPS = 'debug_id_no_sourcemaps',
}

const sourceMapDebugQuery = ({
  orgSlug,
  projectSlug,
  eventId,
  frameIdx,
  exceptionIdx,
}: UseSourceMapDebugProps): ApiQueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/source-map-debug/`,
  {
    query: {
      frame_idx: `${frameIdx}`,
      exception_idx: `${exceptionIdx}`,
    },
  },
];

interface UseSourceMapDebugProps {
  eventId: string;
  exceptionIdx: number;
  frameIdx: number;
  orgSlug: string;
  projectSlug: string;
}

export type StacktraceFilenameQuery = {filename: string; query: UseSourceMapDebugProps};

export function useSourceMapDebug(
  props?: UseSourceMapDebugProps,
  options: Partial<UseApiQueryOptions<SourceMapDebugResponse>> = {}
) {
  return useApiQuery<SourceMapDebugResponse>(props ? sourceMapDebugQuery(props) : [''], {
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    notifyOnChangeProps: ['data'],
    ...options,
    enabled: !!options.enabled && defined(props),
  });
}

export function useSourceMapDebugQueries(props: UseSourceMapDebugProps[]) {
  const api = useApi({persistInFlight: true});

  const options = {
    staleTime: Infinity,
    retry: false,
  };
  return useQueries({
    queries: props.map(p => {
      const key = sourceMapDebugQuery(p);
      return {
        queryKey: sourceMapDebugQuery(p),
        // TODO: Move queryFn as a default in queryClient.tsx
        queryFn: () =>
          api.requestPromise(key[0], {
            method: 'GET',
            query: key[1]?.query,
          }) as Promise<SourceMapDebugResponse>,
        ...options,
      };
    }),
  });
}

const ALLOWED_SDKS = Object.keys(sourceMapSdkDocsMap);
const MAX_FRAMES = 5;

/**
 * Check we have all required props and platform is supported
 */
export function debugFramesEnabled({
  sdkName,
  eventId,
  organization,
  projectSlug,
}: {
  eventId?: string;
  organization?: Organization | null;
  projectSlug?: string;
  sdkName?: string;
}) {
  if (!organization || !organization.features || !projectSlug || !eventId || !sdkName) {
    return false;
  }

  return ALLOWED_SDKS.includes(sdkName);
}

/**
 * Returns an array of unique filenames and the first frame they appear in.
 * Filters out non inApp frames and frames without a line number.
 * Limited to only the first 3 unique filenames.
 */
export function getUniqueFilesFromException(
  excValues: ExceptionValue[],
  props: Omit<UseSourceMapDebugProps, 'frameIdx' | 'exceptionIdx'>
): StacktraceFilenameQuery[] {
  const fileFrame = flatten(
    excValues.map((excValue, exceptionIdx) => {
      return (excValue.stacktrace?.frames || [])
        .map<[Frame, number]>((frame, idx) => [frame, idx])
        .filter(
          ([frame]) =>
            // Only debug inApp frames
            frame.inApp &&
            // Only debug frames with a filename that are not <anonymous> etc.
            !isFrameFilenamePathlike(frame) &&
            // Line number might not work for non-javascript languages
            defined(frame.lineNo)
        )
        .map<StacktraceFilenameQuery>(([frame, idx]) => ({
          filename: frame.filename!,
          query: {...props, frameIdx: idx, exceptionIdx},
        }));
    })
  );

  // Return only the first MAX_FRAMES unique filenames
  return uniqBy(fileFrame.reverse(), ({filename}) => filename).slice(0, MAX_FRAMES);
}
