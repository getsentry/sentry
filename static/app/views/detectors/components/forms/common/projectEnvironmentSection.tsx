import {Flex} from '@sentry/scraps/layout';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {
  EnvironmentField,
  type EnvironmentConfig,
} from 'sentry/views/detectors/components/forms/common/environmentField';
import {ProjectField} from 'sentry/views/detectors/components/forms/common/projectField';

export type {EnvironmentConfig};

interface ProjectEnvironmentSectionProps {
  environment?: EnvironmentConfig;
  step?: number;
}

export function ProjectEnvironmentSection({
  environment,
  step,
}: ProjectEnvironmentSectionProps) {
  const environmentConfig = {
    includeAllEnvironments: true,
    ...environment,
  };

  return (
    <Container>
      <FormSection
        step={step}
        title={t('Choose the Project and Environment')}
        description={t('This is where issues will be created.')}
      >
        <Flex gap="md">
          <ProjectField />
          <EnvironmentField
            includeAllEnvironments={environmentConfig.includeAllEnvironments}
            {...(environmentConfig.fieldProps ?? {})}
          />
        </Flex>
      </FormSection>
    </Container>
  );
}
