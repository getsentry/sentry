import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {UptimeAssertionsField} from 'sentry/views/alerts/rules/uptime/assertions/field';
import {UptimeSectionGrid} from 'sentry/views/detectors/components/forms/uptime/styles';

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
