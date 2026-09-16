import {skipToken, useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import type {SourceMapDebugResponse} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {
  getSourceMapsDocLinks,
  projectPlatformToDocsMap,
} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionDivider} from 'sentry/views/issueDetails/foldSection';
import {useCopyIssueDetails} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';

import {DiagnosisSection, type DiagnosisState} from './diagnosisSection';
import {ImpactSection} from './impactSection';
import {ProblemSection} from './problemSection';
import {TroubleshootingSection} from './troubleshootingSection';

interface SourceMapIssueDetailsProps {
  eventError: Error | null;
  group: Group;
  isEventPending: boolean;
  onRetryEvent: () => void;
  project: Project;
  event?: Event;
}

export function SourceMapIssueDetails({
  event,
  eventError,
  group,
  isEventPending,
  onRetryEvent,
  project,
}: SourceMapIssueDetailsProps) {
  const organization = useOrganization();
  useCopyIssueDetails(group, event);

  const sampleEventId: unknown = event?.occurrence?.evidenceData?.sampleEventId;
  const canDiagnose =
    typeof sampleEventId === 'string' &&
    sampleEventId.length > 0 &&
    event?.sdk?.name?.startsWith('sentry.javascript.');
  const sourceMapQuery = useQuery({
    ...apiOptions.as<SourceMapDebugResponse>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/events/$eventId/source-map-debug/',
      {
        path: canDiagnose
          ? {
              organizationIdOrSlug: organization.slug,
              projectIdOrSlug: project.slug,
              eventId: sampleEventId,
            }
          : skipToken,
        staleTime: Infinity,
      }
    ),
    retry: false,
    refetchOnWindowFocus: false,
  });

  let state: DiagnosisState;
  if (isEventPending) {
    state = {status: 'loading'};
  } else if (!event && eventError instanceof RequestError && eventError.status === 404) {
    state = {
      status: 'unavailable',
      message: t(
        'No sample event is available for diagnosis. Use the troubleshooting suggestions below.'
      ),
    };
  } else if (!event && eventError) {
    state = {
      status: 'error',
      message: t('Unable to load a sample event for diagnosis.'),
      onRetry: onRetryEvent,
    };
  } else if (!canDiagnose) {
    state = {
      status: 'unavailable',
      message: t(
        'Diagnostic information is unavailable for this sample. Use the troubleshooting suggestions below.'
      ),
    };
  } else if (sourceMapQuery.isPending) {
    state = {status: 'loading'};
  } else if (sourceMapQuery.isError && !sourceMapQuery.data) {
    state =
      sourceMapQuery.error instanceof RequestError && sourceMapQuery.error.status === 404
        ? {
            status: 'unavailable',
            message: t(
              'The sample event is no longer available for diagnosis. Use the troubleshooting suggestions below.'
            ),
          }
        : {
            status: 'error',
            message: t(
              'Unable to load source map diagnostic information for this event.'
            ),
            onRetry: sourceMapQuery.refetch,
          };
  } else {
    state = {status: 'ready', data: sourceMapQuery.data};
  }

  const docsSegment =
    (project.platform && projectPlatformToDocsMap[project.platform]) ?? 'javascript';
  const docLinks = getSourceMapsDocLinks(docsSegment);

  return (
    <Container
      role="main"
      position="relative"
      border="primary"
      background="primary"
      radius="md"
    >
      <ErrorBoundary mini>
        <ProblemSection sourcemapsDocsUrl={docLinks.sourcemaps} />
      </ErrorBoundary>
      <SectionDivider orientation="horizontal" />
      <ErrorBoundary mini>
        <DiagnosisSection state={state} />
      </ErrorBoundary>
      <SectionDivider orientation="horizontal" />
      <ErrorBoundary mini>
        <TroubleshootingSection
          sourcemapsDocsUrl={docLinks.sourcemaps}
          project={project}
        />
      </ErrorBoundary>
      <SectionDivider orientation="horizontal" />
      <ErrorBoundary mini>
        <ImpactSection project={project} />
      </ErrorBoundary>
    </Container>
  );
}
