import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {UptimeAssertionsField} from 'sentry/views/detectors/components/uptime/assertions/field';

import {UptimeSectionGrid} from './styles';

export function UptimeDetectorVerificationSection({step}: {step?: number}) {
  return (
    <Container>
      <FormSection step={step} title={t('Verification')}>
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
