import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
  DetectorType,
} from 'sentry/types/workflowEngine/detectors';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {getDetectorAnalyticsPayload} from 'sentry/views/detectors/components/forms/common/getDetectorAnalyticsPayload';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

interface UseCreateDetectorFormSubmitOptions<TFormData, TUpdatePayload> {
  /**
   * Detector type for analytics tracking when validation fails
   */
  detectorType: DetectorType;
  /**
   * Function to transform form data to API payload
   */
  formDataToEndpointPayload: (formData: TFormData) => TUpdatePayload;
  onError?: (error: unknown) => void;
  onSuccess?: (detector: Detector) => void;
}

export function useCreateDetectorFormSubmit<
  TFormData extends Data,
  TUpdatePayload extends BaseDetectorUpdatePayload,
>({
  detectorType,
  formDataToEndpointPayload,
  onError,
  onSuccess,
}: UseCreateDetectorFormSubmitOptions<TFormData, TUpdatePayload>): OnSubmitCallback {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {mutateAsync: createDetector} = useCreateDetector();

  return useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _, formModel) => {
      const isValid = formModel.validateForm();
      if (!isValid) {
        trackAnalytics('monitor.created', {
          organization,
          detector_type: detectorType,
          success: false,
        });
        return;
      }

      const payload = formDataToEndpointPayload(data as TFormData);

      try {
        const resultDetector = await createDetector(payload);

        trackAnalytics('monitor.created', {
          organization,
          ...getDetectorAnalyticsPayload(resultDetector),
          success: true,
        });

        addSuccessMessage(t('Monitor created successfully'));

        if (onSuccess) {
          onSuccess(resultDetector);
        } else {
          navigate(makeMonitorDetailsPathname(organization.slug, resultDetector.id));
        }

        onSubmitSuccess?.(resultDetector);
      } catch (error) {
        trackAnalytics('monitor.created', {
          organization,
          detector_type: payload.type,
          success: false,
        });

        addErrorMessage(t('Unable to create monitor'));

        if (onError) {
          onError(error);
        }

        onSubmitError?.(error);
      }
    },
    [
      detectorType,
      formDataToEndpointPayload,
      createDetector,
      organization,
      navigate,
      onSuccess,
      onError,
    ]
  );
}
