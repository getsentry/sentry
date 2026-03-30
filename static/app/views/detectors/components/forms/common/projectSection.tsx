import {Container} from 'sentry/components/workflowEngine/ui/container';
import {Section} from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {ProjectField} from 'sentry/views/detectors/components/forms/common/projectField';

export function ProjectSection({step}: {step?: number}) {
  return (
    <Container>
      <Section
        step={step}
        title={t('Choose a Project')}
        description={t('This is where issues will be created.')}
      >
        <ProjectField />
      </Section>
    </Container>
  );
}
