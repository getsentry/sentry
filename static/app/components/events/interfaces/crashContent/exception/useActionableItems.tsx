import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import type {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {ApiQueryKey, useApiQuery, UseApiQueryOptions} from 'sentry/utils/queryClient';

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

interface BaseActionableItem {
  message: string;
  type:
    | SourceMapProcessingIssueType
    | JavascriptProcessingErrors
    | HttpProcessingErrors
    | GenericSchemaErrors
    | ProguardProcessingErrors
    | NativeProcessingErrors;
}

interface UnknownErrorDebugError extends BaseActionableItem {
  type: SourceMapProcessingIssueType.UNKNOWN_ERROR;
}
interface MissingReleaseDebugError extends BaseActionableItem {
  type: SourceMapProcessingIssueType.MISSING_RELEASE;
}
interface MissingSourcemapsDebugError extends BaseActionableItem {
  type: SourceMapProcessingIssueType.MISSING_SOURCEMAPS;
}
interface UrlNotValidDebugError extends BaseActionableItem {
  data: {absPath: string};
  type: SourceMapProcessingIssueType.URL_NOT_VALID;
}
interface PartialMatchDebugError extends BaseActionableItem {
  data: {absPath: string; partialMatchPath: string; urlPrefix: string};
  type: SourceMapProcessingIssueType.PARTIAL_MATCH;
}
interface DistMismatchDebugError extends BaseActionableItem {
  type: SourceMapProcessingIssueType.DIST_MISMATCH;
}
interface SourcemapNotFoundDebugError extends BaseActionableItem {
  type: SourceMapProcessingIssueType.SOURCEMAP_NOT_FOUND;
}
interface NoURLMatchDebugError extends BaseActionableItem {
  data: {absPath: string};
  type: SourceMapProcessingIssueType.NO_URL_MATCH;
}
interface DebugIdNotSetUpError extends BaseActionableItem {
  type: SourceMapProcessingIssueType.DEBUG_ID_NO_SOURCEMAPS;
}

interface ProguardMissingLineNoError extends BaseActionableItem {
  type: ProguardProcessingErrors.PROGUARD_MISSING_LINENO;
}
interface ProguardMissingMappingError extends BaseActionableItem {
  type: ProguardProcessingErrors.PROGUARD_MISSING_MAPPING;
}

interface NativeMissingOptionalBundledDSYMError extends BaseActionableItem {
  type: NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM;
}
interface NativeMissingDSYMError extends BaseActionableItem {
  type: NativeProcessingErrors.NATIVE_MISSING_DSYM;
}
interface NativeBadDSYMError extends BaseActionableItem {
  type: NativeProcessingErrors.NATIVE_BAD_DSYM;
}

interface JSMissingSourcesContentError extends BaseActionableItem {
  type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTEXT;
}

interface FetchGenericError extends BaseActionableItem {
  type: HttpProcessingErrors.FETCH_GENERIC_ERROR;
}
interface RestrictedIpError extends BaseActionableItem {
  type: HttpProcessingErrors.RESTRICTED_IP;
}
interface SecurityViolationError extends BaseActionableItem {
  type: HttpProcessingErrors.SECURITY_VIOLATION;
}

interface FutureTimestampError extends BaseActionableItem {
  type: GenericSchemaErrors.FUTURE_TIMESTAMP;
}
interface ClockDriftError extends BaseActionableItem {
  type: GenericSchemaErrors.CLOCK_DRIFT;
}
interface PastTimestampError extends BaseActionableItem {
  type: GenericSchemaErrors.PAST_TIMESTAMP;
}

interface ValueTooLongError extends BaseActionableItem {
  type: GenericSchemaErrors.VALUE_TOO_LONG;
}
interface InvalidDataError extends BaseActionableItem {
  type: GenericSchemaErrors.INVALID_DATA;
}
interface InvalidEnvironmentError extends BaseActionableItem {
  type: GenericSchemaErrors.INVALID_ENVIRONMENT;
}
interface InvalidAttributeError extends BaseActionableItem {
  type: GenericSchemaErrors.INVALID_ATTRIBUTE;
}

export type ActionableItems =
  | UnknownErrorDebugError
  | MissingReleaseDebugError
  | MissingSourcemapsDebugError
  | UrlNotValidDebugError
  | PartialMatchDebugError
  | DistMismatchDebugError
  | SourcemapNotFoundDebugError
  | NoURLMatchDebugError
  | DebugIdNotSetUpError
  | ProguardMissingLineNoError
  | ProguardMissingMappingError
  | NativeMissingOptionalBundledDSYMError
  | NativeMissingDSYMError
  | NativeBadDSYMError
  | JSMissingSourcesContentError
  | FetchGenericError
  | RestrictedIpError
  | SecurityViolationError
  | FutureTimestampError
  | ClockDriftError
  | PastTimestampError
  | ValueTooLongError
  | InvalidDataError
  | InvalidEnvironmentError
  | InvalidAttributeError;

export interface ActionableItemsResponse {
  actions: ActionableItems[];
}

const actionableItemsQuery = ({
  orgSlug,
  projectSlug,
  eventId,
}: UseActionableItemsProps): ApiQueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/actionable-items/`,
];

interface UseActionableItemsProps {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

export function useActionableItems(
  props?: UseActionableItemsProps,
  options: Partial<UseApiQueryOptions<ActionableItemsResponse>> = {}
) {
  return useApiQuery<ActionableItemsResponse>(
    props ? actionableItemsQuery(props) : [''],
    {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ['data'],
      ...options,
      enabled: !!options.enabled && defined(props),
    }
  );
}

/**
 * Check we have all required props and feature flag
 */
export function actionablIemsEnabled({
  eventId,
  organization,
  projectSlug,
}: {
  eventId?: string;
  organization?: Organization | null;
  projectSlug?: string;
}) {
  if (!organization || !organization.features || !projectSlug || !eventId) {
    return false;
  }
  if (organization.features.includes('organization:actionable-items')) {
    return true;
  }
  return false;
}
