import type {EventErrorData} from 'sentry/components/events/errorItem';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadException from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import ExternalLink from 'sentry/components/links/externalLink';
import type {HttpProcessingErrors} from 'sentry/constants/eventErrors';
import {
  CocoaProcessingErrors,
  GenericSchemaErrors,
  JavascriptProcessingErrors,
  NativeProcessingErrors,
  ProguardProcessingErrors,
} from 'sentry/constants/eventErrors';
import {t, tct} from 'sentry/locale';
import type {DebugFile} from 'sentry/types/debugFiles';
import type {Image} from 'sentry/types/debugImage';
import type {Event, ExceptionValue, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {semverCompare} from 'sentry/utils/versions/semverCompare';

const MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH =
  /^(([\w\$]\.[\w\$]{1,2})|([\w\$]{2}\.[\w\$]\.[\w\$]))(\.|$)/g;

export type ActionableItemTypes =
  | JavascriptProcessingErrors
  | HttpProcessingErrors
  | GenericSchemaErrors
  | ProguardProcessingErrors
  | NativeProcessingErrors;

export const ActionableItemWarning = [
  ProguardProcessingErrors.PROGUARD_MISSING_LINENO,
  NativeProcessingErrors.NATIVE_MISSING_OPTIONALLY_BUNDLED_DSYM,
  NativeProcessingErrors.NATIVE_SYMBOLICATOR_FAILED,
  NativeProcessingErrors.NATIVE_INTERNAL_FAILURE,
  GenericSchemaErrors.FUTURE_TIMESTAMP,
  GenericSchemaErrors.CLOCK_DRIFT,
  GenericSchemaErrors.PAST_TIMESTAMP,
  GenericSchemaErrors.VALUE_TOO_LONG,
  GenericSchemaErrors.INVALID_DATA,
  GenericSchemaErrors.INVALID_ATTRIBUTE,
  GenericSchemaErrors.MISSING_ATTRIBUTE,
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

interface NativeSymbolicatorFailedError extends BaseActionableItem {
  type: NativeProcessingErrors.NATIVE_SYMBOLICATOR_FAILED;
}

interface NativeInternalFailureError extends BaseActionableItem {
  type: NativeProcessingErrors.NATIVE_INTERNAL_FAILURE;
}

interface JSMissingSourcesContentError extends BaseActionableItem {
  type: JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT;
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

export type ActionableItemErrors =
  | ProguardMissingLineNoError
  | ProguardMissingMappingError
  | NativeMissingOptionalBundledDSYMError
  | NativeMissingDSYMError
  | NativeBadDSYMError
  | NativeSymbolicatorFailedError
  | NativeInternalFailureError
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

export function shouldErrorBeShown(error: EventErrorData, event: Event) {
  if (
    error.type === CocoaProcessingErrors.COCOA_INVALID_DATA &&
    event.sdk?.name === 'sentry.cocoa' &&
    error.data?.name === 'contexts.trace.sampled' &&
    semverCompare(event.sdk?.version || '', '8.7.4') === -1
  ) {
    // The Cocoa SDK sends wrong values for contexts.trace.sampled before 8.7.4
    return false;
  }
  // Hide unactionable source context errors that happen in flutter web: https://github.com/getsentry/sentry-dart/issues/1764
  if (
    event.sdk?.name === 'sentry.dart.flutter' &&
    error.type === JavascriptProcessingErrors.JS_MISSING_SOURCES_CONTENT
  ) {
    const source: string | undefined = error.data?.source;
    if (
      source &&
      (source.includes('org-dartlang-sdk:///dart-sdk/lib/_internal') ||
        source.includes('flutter/packages/flutter/lib'))
    ) {
      return false;
    }
  }
  return true;
}

function isDataMinified(str: string | null) {
  if (!str) {
    return false;
  }

  return MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH.test(str);
}

const hasThreadOrExceptionMinifiedFrameData = (
  definedEvent: Event,
  bestThread?: Thread
) => {
  if (!bestThread) {
    const exceptionValues: Array<ExceptionValue> =
      definedEvent.entries?.find(e => e.type === EntryType.EXCEPTION)?.data?.values ?? [];

    return exceptionValues.some(exceptionValue =>
      exceptionValue.stacktrace?.frames?.some(frame => isDataMinified(frame.module))
    );
  }

  const threadExceptionValues = getThreadException(definedEvent, bestThread)?.values;

  return threadExceptionValues
    ? threadExceptionValues.some(threadExceptionValue =>
        threadExceptionValue.stacktrace?.frames?.some(frame =>
          isDataMinified(frame.module)
        )
      )
    : bestThread?.stacktrace?.frames?.some(frame => isDataMinified(frame.module));
};

export const useFetchProguardMappingFiles = ({
  event,
  isShare,
  project,
}: {
  event: Event;
  isShare: boolean;
  project: Project;
}): {proguardErrors: EventErrorData[]; proguardErrorsLoading: boolean} => {
  const organization = useOrganization();
  const hasEventErrorsProGuardMissingMapping = event.errors?.find(
    error => error.type === 'proguard_missing_mapping'
  );

  const debugImages = event.entries?.find(e => e.type === EntryType.DEBUGMETA)?.data
    .images as undefined | Array<Image>;

  // When debugImages contains a 'proguard' entry, it must always be only one entry
  const proGuardImage = debugImages?.find(debugImage => debugImage?.type === 'proguard');

  const proGuardImageUuid = proGuardImage?.uuid;

  const shouldFetch =
    defined(proGuardImageUuid) &&
    event.platform === 'java' &&
    !hasEventErrorsProGuardMissingMapping &&
    !isShare;

  const {
    data: proguardMappingFiles,
    isSuccess,
    isPending,
  } = useApiQuery<DebugFile[]>(
    [
      `/projects/${organization.slug}/${project.slug}/files/dsyms/`,
      {
        query: {
          query: proGuardImageUuid,
          file_formats: 'proguard',
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: shouldFetch,
      retry: false,
    }
  );

  function getProguardErrorsFromMappingFiles(): EventErrorData[] {
    if (isShare) {
      return [];
    }

    if (shouldFetch) {
      if (!isSuccess || proguardMappingFiles.length > 0) {
        return [];
      }

      return [
        {
          type: 'proguard_missing_mapping',
          message: t('A proguard mapping file was missing.'),
          data: {mapping_uuid: proGuardImageUuid},
        },
      ];
    }

    const threads: Array<Thread> =
      event.entries?.find(e => e.type === EntryType.THREADS)?.data?.values ?? [];

    const bestThread = findBestThread(threads);
    const hasThreadOrExceptionMinifiedData = hasThreadOrExceptionMinifiedFrameData(
      event,
      bestThread
    );

    if (hasThreadOrExceptionMinifiedData) {
      return [
        {
          type: 'proguard_potentially_misconfigured_plugin',
          message: tct(
            'Some frames appear to be minified. Did you configure the [plugin]?',
            {
              plugin: (
                <ExternalLink
                  href="https://docs.sentry.io/platforms/android/proguard/#gradle"
                  onClick={() => {
                    trackAnalytics('issue_error_banner.proguard_misconfigured.clicked', {
                      organization,
                      group: event?.groupID,
                    });
                  }}
                >
                  Sentry Gradle Plugin
                </ExternalLink>
              ),
            }
          ),
        },
      ];
    }

    return [];
  }

  return {
    proguardErrorsLoading: shouldFetch && isPending,
    proguardErrors: getProguardErrorsFromMappingFiles(),
  };
};
