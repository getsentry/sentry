import {useEffect} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import uniq from 'lodash/uniq';
import uniqWith from 'lodash/uniqWith';

import {Alert} from 'sentry/components/alert';
import {ErrorItem, EventErrorData} from 'sentry/components/events/errorItem';
import findBestThread from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import getThreadException from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import {JavascriptProcessingErrors} from 'sentry/constants/eventErrors';
import {tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {DebugFile} from 'sentry/types/debugFiles';
import {Image} from 'sentry/types/debugImage';
import {EntryType, Event, ExceptionValue, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {projectProcessingIssuesMessages} from 'sentry/views/settings/project/projectProcessingIssues';

import {DataSection} from './styles';

const ERRORS_TO_HIDE = [JavascriptProcessingErrors.JS_MISSING_SOURCE];

const MAX_ERRORS = 100;
const MINIFIED_DATA_JAVA_EVENT_REGEX_MATCH =
  /^(([\w\$]\.[\w\$]{1,2})|([\w\$]{2}\.[\w\$]\.[\w\$]))(\.|$)/g;

type EventErrorsProps = {
  event: Event;
  isShare: boolean;
  project: Project;
};

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

const useFetchProguardMappingFiles = ({
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
                    trackAdvancedAnalyticsEvent(
                      'issue_error_banner.proguard_misconfigured.clicked',
                      {
                        organization,
                        group: event?.groupID,
                      }
                    );
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

const useRecordAnalyticsEvent = ({event, project}: {event: Event; project: Project}) => {
  const organization = useOrganization();

  useEffect(() => {
    if (!event || !event.errors || !(event.errors.length > 0)) {
      return;
    }

    const errors = event.errors;
    const errorTypes = errors.map(errorEntries => errorEntries.type);
    const errorMessages = errors.map(errorEntries => errorEntries.message);

    const platform = project.platform;

    // uniquify the array types
    trackAdvancedAnalyticsEvent('issue_error_banner.viewed', {
      organization,
      group: event?.groupID,
      error_type: uniq(errorTypes),
      error_message: uniq(errorMessages),
      ...(platform && {platform}),
    });
  }, [event, organization, project.platform]);
};

export function EventErrors({event, project, isShare}: EventErrorsProps) {
  const organization = useOrganization();
  useRecordAnalyticsEvent({event, project});
  const {proguardErrorsLoading, proguardErrors} = useFetchProguardMappingFiles({
    event,
    project,
    isShare,
  });

  useEffect(() => {
    if (proguardErrors?.length) {
      if (proguardErrors[0]?.type === 'proguard_potentially_misconfigured_plugin') {
        trackAdvancedAnalyticsEvent(
          'issue_error_banner.proguard_misconfigured.displayed',
          {
            organization,
            group: event?.groupID,
            platform: project.platform,
          }
        );
      } else if (proguardErrors[0]?.type === 'proguard_missing_mapping') {
        trackAdvancedAnalyticsEvent(
          'issue_error_banner.proguard_missing_mapping.displayed',
          {
            organization,
            group: event?.groupID,
            platform: project.platform,
          }
        );
      }
    }
    // Just for analytics, only track this once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {errors: eventErrors = [], _meta} = event;

  // XXX: uniqWith returns unique errors and is not performant with large datasets
  const otherErrors: Array<EventErrorData> =
    eventErrors.length > MAX_ERRORS ? eventErrors : uniqWith(eventErrors, isEqual);

  const errors = [...otherErrors, ...proguardErrors].filter(
    error => !ERRORS_TO_HIDE.includes(error.type as JavascriptProcessingErrors)
  );

  if (proguardErrorsLoading) {
    // XXX: This is necessary for acceptance tests to wait until removal since there is
    // no visual loading state.
    return <HiddenDiv data-test-id="event-errors-loading" />;
  }

  if (errors.length === 0) {
    return null;
  }

  return (
    <StyledDataSection>
      <StyledAlert
        type="error"
        showIcon
        data-test-id="event-error-alert"
        expand={
          <ErrorList data-test-id="event-error-details" symbol="bullet">
            {errors.map((error, errorIdx) => {
              const data = error.data ?? {};
              const meta = _meta?.errors?.[errorIdx];
              return <ErrorItem key={errorIdx} error={{...error, data}} meta={meta} />;
            })}
          </ErrorList>
        }
      >
        {tn(
          'There was %s problem processing this event',
          'There were %s problems processing this event',
          errors.length
        )}
      </StyledAlert>
    </StyledDataSection>
  );
}

const HiddenDiv = styled('div')`
  display: none;
`;

const StyledDataSection = styled(DataSection)`
  border-top: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding-top: 0;
  }
`;

const StyledAlert = styled(Alert)`
  margin: ${space(0.5)} 0;
`;

const ErrorList = styled(List)`
  li:last-child {
    margin-bottom: 0;
  }
`;
