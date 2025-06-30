import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';

export function UptimeDetectorFormDetectSection() {
  return (
    <Container>
      <Section title={t('Detect')}>
        <SectionLabel>{t('Interval')}</SectionLabel>
      </Section>
    </Container>
  );
}
