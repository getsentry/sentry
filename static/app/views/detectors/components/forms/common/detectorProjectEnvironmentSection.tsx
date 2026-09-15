import {useState} from 'react';

import {useStore, withFieldGroup} from '@sentry/scraps/form';
import {Container as LayoutContainer, Flex} from '@sentry/scraps/layout';

import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';

import {
  DetectorProjectField,
  type DetectorProjectFieldProps,
} from './detectorProjectField';
import {useDetectorProject} from './useDetectorProject';

export const DetectorProjectEnvironmentSection = withFieldGroup({
  defaultValues: {projectId: '', environment: ''},
  props: {} as DetectorProjectFieldProps & {
    includeAllEnvironments?: boolean;
    requiredEnvironment?: boolean;
    step?: number;
  },
  render: function DetectorProjectEnvironmentSection({
    group,
    step,
    includeAllEnvironments = true,
    requiredEnvironment = false,
    ...props
  }) {
    const projectId = useStore(group.store, state => state.values.projectId);
    const project = useDetectorProject(projectId);
    const [newEnvironment, setNewEnvironment] = useState<string>();
    const options = [
      ...(includeAllEnvironments ? [{value: '', label: t('All Environments')}] : []),
      ...(newEnvironment ? [{value: newEnvironment, label: newEnvironment}] : []),
      ...(project.environments ?? []).map(environment => ({
        value: environment,
        label: environment,
      })),
    ];
    return (
      <Container>
        <FormSection
          step={step}
          title={t('Choose the Project and Environment')}
          description={t('This is where issues will be created.')}
        >
          <Flex gap="md">
            <DetectorProjectField
              form={group}
              fields={{projectId: 'projectId'}}
              {...props}
            />
            <LayoutContainer flex={1} maxWidth="260px">
              <group.AppField name="environment">
                {field => (
                  <field.Layout.Stack
                    label={t('Environment')}
                    required={requiredEnvironment}
                  >
                    <field.Select
                      value={field.state.value}
                      onChange={environment => {
                        if (!project.environments?.includes(environment)) {
                          setNewEnvironment(environment);
                        }
                        field.handleChange(environment);
                      }}
                      options={options}
                      creatable
                      placeholder={t('Environment')}
                      aria-label={t('Select Environment')}
                    />
                  </field.Layout.Stack>
                )}
              </group.AppField>
            </LayoutContainer>
          </Flex>
        </FormSection>
      </Container>
    );
  },
});
