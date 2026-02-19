import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {UptimeAssertionsField} from 'sentry/views/alerts/rules/uptime/assertions/field';
import {useUptimeAssertionFeatures} from 'sentry/views/alerts/rules/uptime/useUptimeAssertionFeatures';
import {UptimeSectionGrid} from 'sentry/views/detectors/components/forms/uptime/styles';

export function UptimeDetectorVerificationSection() {
  const {hasRuntimeAssertions} = useUptimeAssertionFeatures();

  if (!hasRuntimeAssertions) {
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
