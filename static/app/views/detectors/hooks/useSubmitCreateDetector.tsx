import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

interface UseSubmitCreateDetectorOptions {
  detectorType: DetectorType;
}

type SubmitOptions = {onError?: (error: unknown) => void};

export function useSubmitCreateDetector({detectorType}: UseSubmitCreateDetectorOptions) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: createDetector} = useCreateDetector();

  return useCallback(
    async (payload: BaseDetectorUpdatePayload, {onError}: SubmitOptions = {}) => {
      try {
        const resultDetector = await createDetector(payload);

        trackAnalytics('monitor.created', {
          organization,
          ...getDetectorAnalyticsPayload(resultDetector),
          success: true,
        });

        addSuccessMessage(t('Monitor created'));

        navigate(makeMonitorDetailsPathname(organization.slug, resultDetector.id));
      } catch (error) {
        trackAnalytics('monitor.created', {
          organization,
          detector_type: detectorType,
          success: false,
        });

        addErrorMessage(
          (error instanceof RequestError
            ? getWorkflowEngineResponseErrorMessage(error.responseJSON)
            : null) ?? t('Unable to create monitor')
        );

        onError?.(error);
      }
    },
    [createDetector, detectorType, organization, navigate]
  );
}
