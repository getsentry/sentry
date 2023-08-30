import {EventErrorData} from 'sentry/components/events/errorItem';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadException from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';
import {Project} from 'sentry/types';
import {DebugFile} from 'sentry/types/debugFiles';
import {Image} from 'sentry/types/debugImage';
import {EntryType, Event, ExceptionValue, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {projectProcessingIssuesMessages} from 'sentry/views/settings/project/projectProcessingIssues';

const MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH =
  /^(([\w\$]\.[\w\$]{1,2})|([\w\$]{2}\.[\w\$]\.[\w\$]))(\.|$)/g;

function isDataMinified(str: string | null) {
  if (!str) {
    return false;
  }

  return !![...str.matchAll(MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH)].length;
}

const hasThreadOrExceptionMinifiedFrameData = (
  definedEvent: Event,
  bestThread?: Thread
) => {
  if (!bestThread) {
    const exceptionValues: Array<ExceptionValue> =
      definedEvent.entries?.find(e => e.type === EntryType.EXCEPTION)?.data?.values ?? [];

    return !!exceptionValues.find(exceptionValue =>
      exceptionValue.stacktrace?.frames?.find(frame => isDataMinified(frame.module))
    );
  }

  const threadExceptionValues = getThreadException(definedEvent, bestThread)?.values;

  return !!(threadExceptionValues
    ? threadExceptionValues.find(threadExceptionValue =>
        threadExceptionValue.stacktrace?.frames?.find(frame =>
          isDataMinified(frame.module)
        )
      )
    : bestThread?.stacktrace?.frames?.find(frame => isDataMinified(frame.module)));
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
    isLoading,
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
    }
  );

  const getProguardErrorsFromMappingFiles = () => {
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
          message: projectProcessingIssuesMessages.proguard_missing_mapping,
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
  };

  return {
    proguardErrorsLoading: shouldFetch && isLoading,
    proguardErrors: getProguardErrorsFromMappingFiles(),
  };
};
