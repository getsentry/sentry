import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {NewDetectorForm} from 'sentry/views/detectors/components/forms';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {
  getDetectorTypeLabel,
  isValidDetectorType,
} from 'sentry/views/detectors/utils/detectorTypeConfig';

export default function DetectorNewSettings() {
  const location = useLocation();
  const {projects, fetching: isFetchingProjects} = useProjects();
  const detectorType = location.query.detectorType as DetectorType;
  useWorkflowEngineFeatureGate({redirect: true});

  if (!isValidDetectorType(detectorType)) {
    return <LoadingError message={t('Invalid detector type: %s', detectorType)} />;
  }

  if (isFetchingProjects) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LoadingIndicator />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  const project = projects.find(p => p.id === (location.query.project as string));
  if (!project) {
    return <LoadingError message={t('Project not found')} />;
  }

  return (
    <DetectorFormProvider detectorType={detectorType} project={project}>
      <SentryDocumentTitle
        title={t('New %s Monitor', getDetectorTypeLabel(detectorType))}
      />
      <NewDetectorForm detectorType={detectorType} />
    </DetectorFormProvider>
  );
}
