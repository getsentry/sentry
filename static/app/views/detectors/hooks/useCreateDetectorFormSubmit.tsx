import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Data, OnSubmitCallback} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {
  BaseDetectorUpdatePayload,
  Detector,
} from 'sentry/types/workflowEngine/detectors';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import {useMonitorViewContext} from 'sentry/views/detectors/monitorViewContext';
import {makeMonitorDetailsPathname} from 'sentry/views/detectors/pathnames';

interface UseCreateDetectorFormSubmitOptions<TFormData, TUpdatePayload> {
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
  formDataToEndpointPayload,
  onError,
  onSuccess,
}: UseCreateDetectorFormSubmitOptions<TFormData, TUpdatePayload>): OnSubmitCallback {
  const organization = useOrganization();
  const {monitorsLinkPrefix} = useMonitorViewContext();
  const navigate = useNavigate();
  const {mutateAsync: createDetector} = useCreateDetector();

  return useCallback<OnSubmitCallback>(
    async (data, onSubmitSuccess, onSubmitError, _, formModel) => {
      const isValid = formModel.validateForm();
      if (!isValid) {
        return;
      }

      try {
        const payload = formDataToEndpointPayload(data as TFormData);
        const resultDetector = await createDetector(payload);

        addSuccessMessage(t('Monitor created successfully'));

        if (onSuccess) {
          onSuccess(resultDetector);
        } else {
          navigate(
            makeMonitorDetailsPathname(
              organization.slug,
              resultDetector.id,
              monitorsLinkPrefix
            )
          );
        }

        onSubmitSuccess?.(resultDetector);
      } catch (error) {
        addErrorMessage(t('Unable to create monitor'));

        if (onError) {
          onError(error);
        }

        onSubmitError?.(error);
      }
    },
    [
      formDataToEndpointPayload,
      createDetector,
      organization.slug,
      monitorsLinkPrefix,
      navigate,
      onSuccess,
      onError,
    ]
  );
}
