import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {useParams} from 'sentry/utils/useParams';
import {EditExistingDetectorForm} from 'sentry/views/detectors/components/forms';
import {canEditDetector} from 'sentry/views/detectors/components/forms/config';
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

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  const detectorType = detector.type;
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

  return <EditExistingDetectorForm detector={detector} detectorType={detectorType} />;
}
