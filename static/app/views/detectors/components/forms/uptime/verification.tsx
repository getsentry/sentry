import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {UptimeAssertionsField} from 'sentry/views/alerts/rules/uptime/assertions/field';
import {useUptimeAssertionFeatures} from 'sentry/views/alerts/rules/uptime/useUptimeAssertionFeatures';
import {ConnectedAssertionSuggestionsButton} from 'sentry/views/detectors/components/forms/uptime/connectedAssertionSuggestionsButton';
import {ConnectedTestUptimeMonitorButton} from 'sentry/views/detectors/components/forms/uptime/connectedTestUptimeMonitorButton';
import {UptimeSectionGrid} from 'sentry/views/detectors/components/forms/uptime/styles';

export function UptimeDetectorVerificationSection() {
  const {hasRuntimeAssertions, hasAiAssertionSuggestions} = useUptimeAssertionFeatures();

  if (!hasRuntimeAssertions) {
    return null;
  }

  return (
    <Container>
      <Section
        title={t('Verification')}
        trailingItems={<ConnectedTestUptimeMonitorButton size="xs" />}
      >
        <UptimeSectionGrid>
          <UptimeAssertionsField
            name="assertion"
            label={t('Assertions')}
            help={t(
              'Define conditions that must be met for the check to be considered successful.'
            )}
            flexibleControlStateSize
            trailingButtons={
              hasAiAssertionSuggestions ? (
                <ConnectedAssertionSuggestionsButton size="sm" />
              ) : undefined
            }
          />
        </UptimeSectionGrid>
      </Section>
    </Container>
  );
}
