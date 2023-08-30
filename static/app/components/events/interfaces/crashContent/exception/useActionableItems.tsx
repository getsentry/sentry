import {
  GenericSchemaErrors,
  HttpProcessingErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import type {Organization, SharedViewOrganization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

export type ActionableItemTypes =
  | JavascriptProcessingErrors
  | HttpProcessingErrors
  | GenericSchemaErrors
  | ProguardProcessingErrors
  | NativeProcessingErrors;

export const ActionableItemWarning = [
  ProguardProcessingErrors.PROGUARD_MISSING_LINENO,
  NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
  GenericSchemaErrors.FUTURE_TIMESTAMP,
  GenericSchemaErrors.CLOCK_DRIFT,
  GenericSchemaErrors.PAST_TIMESTAMP,
  GenericSchemaErrors.VALUE_TOO_LONG,
];

interface BaseActionableItem {
  data: any;
  message: string;
  type: ActionableItemTypes;
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
