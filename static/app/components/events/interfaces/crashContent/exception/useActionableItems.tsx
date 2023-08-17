import startCase from 'lodash/startCase';
import moment from 'moment';

import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t} from 'sentry/locale';
import type {Organization, SharedViewOrganization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

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

export type ActionableItemTypes =
  | SourceMapProcessingIssueType
  | JavascriptProcessingErrors
  | HttpProcessingErrors
  | GenericSchemaErrors
  | ProguardProcessingErrors
  | NativeProcessingErrors;

interface BaseActionableItem {
  message: string;
  type: ActionableItemTypes;
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

const actionableItemsQuery = ({
  orgSlug,
  projectSlug,
  eventId,
}: UseActionableItemsProps): ApiQueryKey => [
  `/projects/${orgSlug}/${projectSlug}/events/${eventId}/actionable-items/`,
];

export interface ActionableItemsResponse {
  errors: ActionableItems[];
}

interface UseActionableItemsProps {
  eventId: string;
  orgSlug: string;
  projectSlug: string;
}

export function useActionableItems(props?: UseActionableItemsProps) {
  return useApiQuery<ActionableItemsResponse>(
    props ? actionableItemsQuery(props) : [''],
    {
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
      notifyOnChangeProps: ['data'],
      enabled: defined(props),
    }
  );
}

/**
 * Check we have all required props and feature flag
 */
export function actionableItemsEnabled({
  eventId,
  organization,
  projectSlug,
}: {
  eventId?: string;
  organization?: Organization | SharedViewOrganization | null;
  projectSlug?: string;
}) {
  if (!organization || !organization.features || !projectSlug || !eventId) {
    return false;
  }
  return organization.features.includes('actionable-items');
}

export function cleanData(data) {
  // The name is rendered as path in front of the message
  if (typeof data.name === 'string') {
    delete data.name;
  }

  if (data.message === 'None') {
    // Python ensures a message string, but "None" doesn't make sense here
    delete data.message;
  }

  if (typeof data.image_path === 'string') {
    // Separate the image name for readability
    const separator = /^([a-z]:\\|\\\\)/i.test(data.image_path) ? '\\' : '/';
    const path = data.image_path.split(separator);
    data.image_name = path.splice(-1, 1)[0];
    data.image_path = path.length ? path.join(separator) + separator : '';
  }

  if (typeof data.server_time === 'string' && typeof data.sdk_time === 'string') {
    data.message = t(
      'Adjusted timestamps by %s',
      moment
        .duration(moment.utc(data.server_time).diff(moment.utc(data.sdk_time)))
        .humanize()
    );
  }

  return Object.entries(data)
    .map(([key, value]) => ({
      key,
      value,
      subject: keyMapping[key] || startCase(key),
    }))
    .filter(d => {
      if (!d.value) {
        return true;
      }
      return !!d.value;
    });
}
