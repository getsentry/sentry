import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';
import {useUpdateDetector} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

interface UseEditDetectorFormSubmitOptions<TDetector, TFormData> {
  detector: TDetector;
  /**
   * Function to transform form data to API payload
   */
  formDataToEndpointPayload: (formData: TFormData) => BaseDetectorUpdatePayload;
  onError?: (error: unknown) => void;
  onSuccess?: (detector: TDetector) => void;
}

export function useEditDetectorFormSubmit<
  TDetector extends Detector,
  TFormData extends Record<string, unknown>,
>({
  detector,
  formDataToEndpointPayload,
  onSuccess,
  onError,
}: UseEditDetectorFormSubmitOptions<TDetector, TFormData>): OnSubmitCallback {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: updateDetector} = useUpdateDetector();

  return useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _, formModel) => {
      const isValid = formModel.validateForm();
      if (!isValid) {
        return;
      }

      try {
        const payload = formDataToEndpointPayload(data as TFormData);

        const updatedData = {
          detectorId: detector.id,
          ...payload,
        };

        const resultDetector = await updateDetector(updatedData);

        trackAnalytics('monitor.updated', {
          organization,
          ...getDetectorAnalyticsPayload(resultDetector),
        });

        addSuccessMessage(t('Monitor updated successfully'));

        if (onSuccess) {
          onSuccess(resultDetector as TDetector);
        } else {
          navigate(makeMonitorDetailsPathname(organization.slug, resultDetector.id));
        }

        onSubmitSuccess?.(resultDetector);
      } catch (error) {
        addErrorMessage(t('Unable to update monitor'));

        if (onError) {
          onError(error);
        }

        onSubmitError?.(error);
      }
    },
    [
      detector,
      formDataToEndpointPayload,
      updateDetector,
      organization,
      navigate,
      onSuccess,
      onError,
    ]
  );
}
