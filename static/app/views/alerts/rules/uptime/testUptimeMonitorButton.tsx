import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button, type ButtonProps} from 'sentry/components/core/button';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  PreviewCheckStatus,
  type Assertion,
  type PreviewCheckPayload,
  type PreviewCheckResponse,
} from 'sentry/views/alerts/rules/uptime/types';

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
   * Button size
   */
  size?: ButtonProps['size'];
}

export function TestUptimeMonitorButton({
  getFormData,
  label,
  size,
}: TestUptimeMonitorButtonProps) {
  const organization = useOrganization();

  const {mutate: runPreviewCheck, isPending} = useMutation<
    PreviewCheckResponse,
    RequestError,
    PreviewCheckPayload
  >({
    mutationFn: (payload: PreviewCheckPayload) =>
      fetchMutation<PreviewCheckResponse>({
        url: `/organizations/${organization.slug}/uptime-preview-check/`,
        method: 'POST',
        data: {...payload},
      }),
    onSuccess: response => {
      if (response.check_result?.status === PreviewCheckStatus.SUCCESS) {
        addSuccessMessage(t('Uptime check passed successfully'));
      } else {
        addErrorMessage(t('Uptime check failed'));
      }
    },
    onError: () => {
      addErrorMessage(t('Uptime check failed'));
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
