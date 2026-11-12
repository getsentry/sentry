import {useCallback} from 'react';

import {toast} from '@sentry/scraps/toast';

import {getWorkflowEngineResponseErrorMessage} from 'sentry/components/workflowEngine/getWorkflowEngineResponseErrorMessage';
import {t} from 'sentry/locale';
import type {BaseDetectorUpdatePayload} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

type UpdatePayload = {detectorId: string} & Partial<BaseDetectorUpdatePayload>;

/**
 * Handles the common submission logic for edit detector forms:
 * submitting the payload, tracking analytics, showing indicators,
 * and navigating to the detector details page.
 */
export function useSubmitEditDetector() {
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

        toast.success(t('Monitor updated'));

        navigate(makeMonitorDetailsPathname(organization.slug, resultDetector.id));

        return resultDetector;
      } catch (error) {
        toast.error(
          (error instanceof RequestError
            ? getWorkflowEngineResponseErrorMessage(error.responseJSON)
            : null) ?? t('Unable to update monitor')
        );
        return;
      }
    },
    [updateDetector, organization, navigate]
  );
}
