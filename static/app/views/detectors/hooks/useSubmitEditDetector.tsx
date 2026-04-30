import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

type UpdatePayload = {detectorId: string} & Partial<BaseDetectorUpdatePayload>;

interface UseSubmitEditDetectorOptions<TDetector extends Detector> {
  onError?: (error: unknown) => void;
  onSuccess?: (detector: TDetector) => void;
}

/**
 * Handles the common submission logic for edit detector forms:
 * submitting the payload, tracking analytics, showing indicators,
 * and navigating to the detector details page.
 */
export function useSubmitEditDetector<TDetector extends Detector>({
  onSuccess,
  onError,
}: UseSubmitEditDetectorOptions<TDetector> = {}) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: updateDetector} = useUpdateDetector();

  return useCallback(
    async (payload: UpdatePayload) => {
      try {
        const resultDetector = await updateDetector(payload);

        trackAnalytics('monitor.updated', {
          organization,
          ...getDetectorAnalyticsPayload(resultDetector),
        });

        addSuccessMessage(t('Monitor updated'));

        if (onSuccess) {
          onSuccess(resultDetector as TDetector);
        } else {
          navigate(makeMonitorDetailsPathname(organization.slug, resultDetector.id));
        }

        return resultDetector;
      } catch (error) {
        addErrorMessage(t('Unable to update monitor'));
        onError?.(error);
        return;
      }
    },
    [updateDetector, organization, navigate, onSuccess, onError]
  );
}
