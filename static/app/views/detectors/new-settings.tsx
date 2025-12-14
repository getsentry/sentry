import orderBy from 'lodash/orderBy';
import {parseAsString, useQueryState} from 'nuqs';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {useDetectorTypeQueryState} from 'sentry/views/detectors/components/detectorTypeForm';
import {NewDetectorForm} from 'sentry/views/detectors/components/forms';
import {DetectorFormProvider} from 'sentry/views/detectors/components/forms/context';
import {
  getDetectorTypeLabel,
  isValidDetectorType,
} from 'sentry/views/detectors/utils/detectorTypeConfig';

export default function DetectorNewSettings() {
  const {projects, fetching: isFetchingProjects} = useProjects();
  const [detectorType] = useDetectorTypeQueryState();
  const [projectId] = useQueryState('project', parseAsString);
  useWorkflowEngineFeatureGate({redirect: true});

  if (!detectorType || !isValidDetectorType(detectorType)) {
    return <LoadingError message={t('Invalid detector type: %s', detectorType ?? '')} />;
  }

  if (isFetchingProjects) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main width="full">
            <LoadingIndicator />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  const project = projectId
    ? projects.find(p => p.id === projectId)
    : orderBy(projects, ['isMember', 'isBookmarked'], ['desc', 'desc'])[0];

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
