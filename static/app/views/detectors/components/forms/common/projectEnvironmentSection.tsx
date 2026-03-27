import {Flex} from '@sentry/scraps/layout';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {Section} from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import {
  EnvironmentField,
  type EnvironmentConfig,
} from 'sentry/views/detectors/components/forms/common/environmentField';
import {ProjectField} from 'sentry/views/detectors/components/forms/common/projectField';

export type {EnvironmentConfig};

interface ProjectEnvironmentSectionProps {
  environment?: EnvironmentConfig;
}

export function ProjectEnvironmentSection({environment}: ProjectEnvironmentSectionProps) {
  const environmentConfig = {
    includeAllEnvironments: true,
    ...environment,
  };

  return (
    <Container>
      <Section
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
      </Section>
    </Container>
  );
}
