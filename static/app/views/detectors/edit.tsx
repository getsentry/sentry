import {Fragment} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {useParams} from 'sentry/utils/useParams';
import {EditExistingDetectorForm} from 'sentry/views/detectors/components/forms';
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

  return (
    <Fragment>
      <EditExistingDetectorForm detector={detector} />
    </Fragment>
  );
}
