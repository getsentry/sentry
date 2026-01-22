import {useContext} from 'react';

import FormContext from 'sentry/components/forms/formContext';
import {defined} from 'sentry/utils';
import {TestUptimeMonitorButton} from 'sentry/views/alerts/rules/uptime/testUptimeMonitorButton';
import {DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP} from 'sentry/views/detectors/components/forms/uptime/fields';

export function ConnectedTestUptimeMonitorButton() {
  const {form} = useContext(FormContext);

  const getFormData = () => {
    const data = form?.getTransformedData() ?? {};
    return {
      url: data.url || undefined,
      method: data.method || DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.method,
      headers: data.headers ?? DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.headers,
      body: data.body || null,
      timeoutMs: defined(data.timeoutMs)
        ? data.timeoutMs
        : DEFAULT_UPTIME_DETECTOR_FORM_DATA_MAP.timeoutMs,
      assertion: data.assertion ?? null,
    };
  };

  return <TestUptimeMonitorButton getFormData={getFormData} />;
}
