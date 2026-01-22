import {useCallback} from 'react';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {UptimeAssertionsField} from 'sentry/views/alerts/rules/uptime/assertions/field';
import {TestUptimeMonitorButton} from 'sentry/views/alerts/rules/uptime/testUptimeMonitorButton';
import {useUptimeDetectorFormField} from 'sentry/views/detectors/components/forms/uptime/fields';
import {UptimeSectionGrid} from 'sentry/views/detectors/components/forms/uptime/styles';

export function ConnectedTestUptimeMonitorButton() {
  const url = useUptimeDetectorFormField('url');
  const method = useUptimeDetectorFormField('method');
  const headers = useUptimeDetectorFormField('headers');
  const body = useUptimeDetectorFormField('body');
  const timeoutMs = useUptimeDetectorFormField('timeoutMs');
  const assertion = useUptimeDetectorFormField('assertion');

  const getFormData = useCallback(
    () => ({
      url,
      method,
      headers,
      body: body || null,
      timeoutMs,
      assertion,
    }),
    [url, method, headers, body, timeoutMs, assertion]
  );

  return <TestUptimeMonitorButton getFormData={getFormData} />;
}

export function UptimeDetectorVerificationSection() {
  const org = useOrganization();

  if (!org.features.includes('uptime-runtime-assertions')) {
    return null;
  }

  return (
    <Container>
      <Section title={t('Verification')}>
        <UptimeSectionGrid>
          <UptimeAssertionsField
            name="assertion"
            label={t('Assertions')}
            help={t(
              'Define conditions that must be met for the check to be considered successful.'
            )}
            flexibleControlStateSize
          />
        </UptimeSectionGrid>
      </Section>
    </Container>
  );
}
