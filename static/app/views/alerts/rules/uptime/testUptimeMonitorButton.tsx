import {useCallback, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {RequestOptions} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
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
  const api = useApi();
  const organization = useOrganization();
  const [isLoading, setIsLoading] = useState(false);

  const {mutateAsync: runPreviewCheck} = useMutation<
    UptimePreviewCheckResponse,
    Error,
    UptimePreviewCheckPayload
  >({
    mutationFn: (payload: UptimePreviewCheckPayload) => {
      const options: RequestOptions = {
        method: 'POST',
        data: payload,
      };
      return api.requestPromise(
        `/organizations/${organization.slug}/uptime-preview-check/`,
        options
      );
    },
  });

  const handleTestClick = useCallback(async () => {
    const formData = getFormData();

    if (!formData.url) {
      addErrorMessage(t('Please enter a URL to test'));
      return;
    }

    setIsLoading(true);

    try {
      const payload: UptimePreviewCheckPayload = {
        url: formData.url,
        timeoutMs: formData.timeoutMs ?? 5000,
        method: formData.method ?? 'GET',
        headers: formData.headers ?? [],
        body: formData.body ?? null,
        assertion: formData.assertion ?? null,
        region: 'default',
      };

      await runPreviewCheck(payload);
      addSuccessMessage(t('Uptime check passed successfully'));
    } catch (error) {
      addErrorMessage(t('Uptime check failed'));
    } finally {
      setIsLoading(false);
    }
  }, [getFormData, runPreviewCheck]);

  return (
    <Button
      icon={<IconPlay />}
      onClick={handleTestClick}
      busy={isLoading}
      disabled={isLoading}
    >
      {t('Test Monitor')}
    </Button>
  );
}
