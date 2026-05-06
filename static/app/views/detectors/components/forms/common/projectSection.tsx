import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {ProjectSelectFieldDeprecated} from 'sentry/views/detectors/components/forms/common/projectField';

/**
 * Legacy version for forms using FormModel/FormContext.
 * Remove once all detector forms have migrated to the new form system.
 */
export function ProjectSectionDeprecated({step}: {step?: number}) {
  return (
    <Container>
      <FormSection
        step={step}
        title={t('Choose a Project')}
        description={t('This is where issues will be created.')}
      >
        <ProjectSelectFieldDeprecated />
      </FormSection>
    </Container>
  );
}

export function ProjectSection({
  children,
  step,
}: {
  children: React.ReactNode;
  step?: number;
}) {
  return (
    <Container>
      <FormSection
        step={step}
        title={t('Choose a Project')}
        description={t('This is where issues will be created.')}
      >
        {children}
      </FormSection>
    </Container>
  );
}
