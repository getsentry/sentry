import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {getMonitorRefetchInterval} from 'sentry/views/alerts/rules/crons/utils';
import {DetectorDetailsContent} from 'sentry/views/detectors/components/details';
import {useDetectorQuery} from 'sentry/views/detectors/hooks';

/**
 * Determines the refetch interval for a detector based on its type.
 * This allows different detector types to have custom refetch logic.
 */
function getDetectorRefetchInterval(detector: Detector): number | false {
  switch (detector.type) {
    case 'monitor_check_in_failure': {
      return getMonitorRefetchInterval(detector.dataSources[0].queryObj, new Date());
    }
    default:
      return false;
  }
}

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
  } = useDetectorQuery(params.detectorId, {
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: query => {
      if (!query.state.data) {
        return false;
      }
      const [detectorData] = query.state.data;
      return getDetectorRefetchInterval(detectorData);
    },
  });

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
