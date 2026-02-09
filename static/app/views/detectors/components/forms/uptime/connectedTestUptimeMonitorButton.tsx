import {useCallback, useContext} from 'react';

import type {ButtonProps} from '@sentry/scraps/button';

import FormContext from 'sentry/components/forms/formContext';
import {defined} from 'sentry/utils';
import {mapAssertionFormErrors} from 'sentry/views/alerts/rules/uptime/assertionFormErrors';
import {TestUptimeMonitorButton} from 'sentry/views/alerts/rules/uptime/testUptimeMonitorButton';
import {DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP} from 'sentry/views/detectors/components/forms/uptime/fields';

const HTTP_METHODS_NO_BODY = ['GET', 'HEAD', 'OPTIONS'];

interface ConnectedTestUptimeMonitorButtonProps {
  size?: ButtonProps['size'];
}

export function ConnectedTestUptimeMonitorButton({
  size,
}: ConnectedTestUptimeMonitorButtonProps) {
  const {form} = useContext(FormContext);

  const getFormData = () => {
    const data = form?.getTransformedData() ?? {};
    const method = data.method || DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.method;
    const methodHasBody = !HTTP_METHODS_NO_BODY.includes(method);
    return {
      url: data.url || undefined,
      method,
      headers: data.headers ?? DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.headers,
      body: methodHasBody ? data.body || null : null,
      timeoutMs: defined(data.timeoutMs)
        ? data.timeoutMs
        : DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.timeoutMs,
      assertion: data.assertion ?? null,
    };
  };

  const handleValidationError = useCallback(
    (responseJson: any) => {
      if (form) {
        const mapped = mapAssertionFormErrors(responseJson);
        form.handleErrorResponse({responseJSON: mapped});
      }
    },
    [form]
  );

  return (
    <TestUptimeMonitorButton
      getFormData={getFormData}
      onValidationError={form ? handleValidationError : undefined}
      size={size}
    />
  );
}
