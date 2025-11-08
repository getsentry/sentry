import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {DetectorDetailsContent} from 'sentry/views/detectors/components/details';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';

function DetectorDetailsLoadingStates({
  detectorId,
  project,
  isFetchingProjects,
}: {
  detectorId: string;
  isFetchingProjects: boolean;
  project: Project | undefined;
}) {
  const {
    data: detector,
    isPending,
    isError,
    error,
    refetch,
  } = useDetectorQuery(detectorId);

  if (isPending || isFetchingProjects) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={error.status === 404 ? t('The monitor could not be found.') : undefined}
        onRetry={refetch}
      />
    );
  }

  if (!project) {
    return <LoadingError message={t('Project not found')} />;
  }

  return (
    <SentryDocumentTitle title={detector.name}>
      <DetectorDetailsContent detector={detector} project={project} />
    </SentryDocumentTitle>
  );
}

export default function DetectorDetails() {
  useWorkflowEngineFeatureGate({redirect: true});
  const params = useParams<{detectorId: string}>();
  const {projects, fetching: isFetchingProjects} = useProjects();

  const {data: detector, isPending} = useDetectorQuery(params.detectorId);

  const project = projects.find(p => p.id === detector?.projectId);

  const isLoading = isPending || isFetchingProjects;

  return (
    <VisuallyCompleteWithData
      hasData={defined(detector)}
      id="DetectorDetails-Body"
      isLoading={isLoading}
    >
      <DetectorDetailsLoadingStates
        detectorId={params.detectorId}
        project={project}
        isFetchingProjects={isFetchingProjects}
      />
    </VisuallyCompleteWithData>
  );
}
