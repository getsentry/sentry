import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

export function useSubmitCreateDetector({
  onError,
  onSuccess,
}: {
  onError?: (error: unknown) => void;
  onSuccess?: (detector: Detector) => void;
} = {}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: createDetector} = useCreateDetector();
  return useCallback(
    async (payload: BaseDetectorUpdatePayload) => {
      try {
        const detector = await createDetector(payload);
        trackAnalytics('monitor.created', {
          organization,
          ...getDetectorAnalyticsPayload(detector),
          success: true,
        });
        addSuccessMessage(t('Monitor created'));
        if (onSuccess) {
          onSuccess(detector);
        } else {
          navigate(makeMonitorDetailsPathname(organization.slug, detector.id));
        }
        return detector;
      } catch (error) {
        trackAnalytics('monitor.created', {
          organization,
          detector_type: payload.type,
          success: false,
        });
        addErrorMessage(
          (error instanceof RequestError
            ? getWorkflowEngineResponseErrorMessage(error.responseJSON)
            : null) ?? t('Unable to create monitor')
        );
        onError?.(error);
        return;
      }
    },
    [createDetector, organization, navigate, onSuccess, onError]
  );
}
