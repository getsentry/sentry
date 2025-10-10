import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {DetectorDetailsContent} from 'sentry/views/detectors/components/details';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';

export default function DetectorDetails() {
  useWorkflowEngineFeatureGate({redirect: true});
  const params = useParams<{detectorId: string}>();
  const {projects, fetching: isFetchingProjects} = useProjects();

  const {
    data: detector,
    isPending,
    isError,
    error,
    refetch,
  } = useDetectorQuery(params.detectorId);

  const project = projects.find(p => p.id === detector?.projectId);

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
