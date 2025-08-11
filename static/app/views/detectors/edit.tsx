import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {EditExistingDetectorForm} from 'sentry/views/detectors/components/forms';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';

export default function DetectorEdit() {
  const params = useParams<{detectorId: string}>();
  useWorkflowEngineFeatureGate({redirect: true});

  const {
    data: detector,
    isPending,
    isError,
    refetch,
  } = useDetectorQuery(params.detectorId);

  const {projects, fetching: isFetchingProjects} = useProjects();
  const project = projects.find(p => p.id === detector?.projectId);

  if (isPending || isFetchingProjects) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  if (!project) {
    return <LoadingError message={t('Project not found')} />;
  }

  return (
    <DetectorFormProvider detectorType={detector.type} project={project}>
      <EditExistingDetectorForm detector={detector} />
    </DetectorFormProvider>
  );
}
