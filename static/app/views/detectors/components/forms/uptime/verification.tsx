import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {UptimeAssertionsField} from 'sentry/views/alerts/rules/uptime/assertions/field';
import {useUptimeAssertionFeatures} from 'sentry/views/alerts/rules/uptime/useUptimeAssertionFeatures';
import {ConnectedAssertionSuggestionsButton} from 'sentry/views/detectors/components/forms/uptime/connectedAssertionSuggestionsButton';
import {UptimeSectionGrid} from 'sentry/views/detectors/components/forms/uptime/styles';

export function UptimeDetectorVerificationSection({step}: {step?: number}) {
  const {hasAiAssertionSuggestions} = useUptimeAssertionFeatures();

  return (
    <Container>
      <FormSection
        step={step}
        title={t('Verification')}
        trailingItems={
          hasAiAssertionSuggestions ? (
            <ConnectedAssertionSuggestionsButton size="xs" />
          ) : undefined
        }
      >
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
      </FormSection>
    </Container>
  );
}
