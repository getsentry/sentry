import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {NewDetectorForm} from 'sentry/views/detectors/components/forms';
import {canEditDetector} from 'sentry/views/detectors/components/forms/config';

export default function DetectorNewSettings() {
  const location = useLocation();
  const {fetching: isFetchingProjects} = useProjects();
  const detectorType = location.query.detectorType as DetectorType;
  useWorkflowEngineFeatureGate({redirect: true});

  if (!canEditDetector(detectorType)) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LoadingError message={t('This monitor type is not editable')} />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
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

  return <NewDetectorForm detectorType={detectorType} />;
}
