import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import type {Assertion} from 'sentry/views/alerts/rules/uptime/types';

interface UptimePreviewCheckPayload {
  region: string;
  timeoutMs: number;
  url: string;
  assertion?: Assertion | null;
  body?: string | null;
  headers?: Array<[string, string]>;
  method?: string;
}

type UptimePreviewCheckResponse = Record<string, unknown>;

interface TestUptimeMonitorButtonProps {
  /**
   * Callback to get the current form data for the test request
   */
  getFormData: () => {
    url: string | undefined;
    assertion?: Assertion | null;
    body?: string | null;
    headers?: Array<[string, string]>;
    method?: string;
    timeoutMs?: number;
  };
}

export function TestUptimeMonitorButton({getFormData}: TestUptimeMonitorButtonProps) {
  const organization = useOrganization();

  const {mutate: runPreviewCheck, isPending} = useMutation<
    UptimePreviewCheckResponse,
    RequestError,
    UptimePreviewCheckPayload
  >({
    mutationFn: (payload: UptimePreviewCheckPayload) =>
      fetchMutation<UptimePreviewCheckResponse>({
        url: `/organizations/${organization.slug}/uptime-preview-check/`,
        method: 'POST',
        data: {...payload},
      }),
    onSuccess: () => {
      addSuccessMessage(t('Uptime check passed successfully'));
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
      timeoutMs: formData.timeoutMs ?? 5000,
      method: formData.method ?? 'GET',
      headers: formData.headers ?? [],
      body: formData.body ?? null,
      assertion: formData.assertion ?? null,
      region: 'default',
    });
  }, [getFormData, runPreviewCheck]);

  return (
    <Button
      icon={<IconPlay />}
      onClick={handleTestClick}
      busy={isPending}
      disabled={isPending}
    >
      {t('Test Monitor')}
    </Button>
  );
}
