import {useCallback} from 'react';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  PreviewCheckStatus,
  type Assertion,
  type PreviewCheckPayload,
  type PreviewCheckResult,
} from 'sentry/views/alerts/rules/uptime/types';
import { extractCompilationError, usePreviewCheckResult } from './previewCheckContext';
import { mapPreviewCheckErrorToMessage, mapPreviewCheckResponseToMessage } from './assertionFormErrors';

interface TestUptimeMonitorButtonProps {
  /**
   * Callback to get the current form data for the test request.
   * The caller is responsible for providing fallback values appropriate to their context.
   */
  getFormData: () => {
    assertion: Assertion | null;
    body: string | null;
    headers: Array<[string, string]>;
    method: string;
    timeoutMs: number;
    url: string | undefined;
  };
  /**
   * Button label text
   */
  label?: string;
  /**
   * Called when the preview check returns a validation error (e.g. assertion
   * compilation errors). Receives the parsed response JSON so callers can
   * surface the errors on form fields.
   */
  onValidationError?: (responseJson: any) => void;
  /**
   * Button size
   */
  size?: ButtonProps['size'];
}

export function TestUptimeMonitorButton({
  getFormData,
  label,
  onValidationError,
  size,
}: TestUptimeMonitorButtonProps) {
  const organization = useOrganization();
  const {setPreviewCheckData, setPreviewCheckError} = usePreviewCheckResult();

  const {mutate: runPreviewCheck, isPending} = useMutation<
    PreviewCheckResult,
    RequestError,
    PreviewCheckPayload
  >({
    mutationFn: (payload: PreviewCheckPayload) =>
      fetchMutation<PreviewCheckResult>({
        url: `/organizations/${organization.slug}/uptime-preview-check/`,
        method: 'POST',
        data: {...payload},
      }),
    onSuccess: response => {
      setPreviewCheckData(response);
      if (response.check_result?.status === PreviewCheckStatus.SUCCESS) {
        addSuccessMessage(t('Uptime check passed successfully'));
      } else {
        const trailingMessage = mapPreviewCheckResponseToMessage(response);
        addErrorMessage(t('Uptime check failed %s', trailingMessage ? `(${trailingMessage})` : ''));
      }
    },
    onError: (error: RequestError) => {
      const extractedError = extractCompilationError(error.responseJSON);
      setPreviewCheckError(extractedError);

      if (onValidationError && error.status === 400 && error.responseJSON) {
        onValidationError(error.responseJSON);
      } else {
        const trailingMessage = mapPreviewCheckErrorToMessage(extractedError);
        addErrorMessage(t('Uptime check failed %s', trailingMessage ? `(${trailingMessage})` : ''));
      }
    },
  });

  const handleTestClick = useCallback(() => {
    const formData = getFormData();

    if (!formData.url) {
      addErrorMessage(t('Please enter a URL to test'));
      return;
    }

    runPreviewCheck({
      url: formData.url,
      timeoutMs: formData.timeoutMs,
      method: formData.method,
      headers: formData.headers,
      body: formData.body,
      assertion: formData.assertion,
    });
  }, [getFormData, runPreviewCheck]);

  return (
    <Button onClick={handleTestClick} busy={isPending} disabled={isPending} size={size}>
      {label ?? t('Test Monitor')}
    </Button>
  );
}
