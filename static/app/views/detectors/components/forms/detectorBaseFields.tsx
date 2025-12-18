import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import EditableText from 'sentry/components/editableText';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import FormField from 'sentry/components/forms/formField';
import * as Layout from 'sentry/components/layouts/thirds';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

interface DetectorBaseFieldsProps {
  envFieldProps?: Partial<React.ComponentProps<typeof SelectField>>;
  noEnvironment?: boolean;
}

export function DetectorBaseFields({
  noEnvironment,
  envFieldProps,
}: DetectorBaseFieldsProps) {
  const {setHasSetDetectorName} = useDetectorFormContext();

  return (
    <Flex gap="md" direction="column">
      <Layout.Title>
        <FormField name="name" inline={false} flexibleControlStateSize stacked>
          {({onChange, value}) => (
            <EditableText
              allowEmpty
              value={value || ''}
              onChange={newValue => {
                onChange(newValue, {
                  target: {
                    value: newValue,
                  },
                });
                setHasSetDetectorName(true);
              }}
              placeholder={t('New Monitor')}
              aria-label={t('Monitor Name')}
            />
          )}
        </FormField>
      </Layout.Title>
      <Flex gap="md">
        <ProjectField />
        {!noEnvironment && <EnvironmentField {...envFieldProps} />}
      </Flex>
    </Flex>
  );
}

function ProjectField() {
  const {projects, fetching} = useProjects();
  const {project, detectorType} = useDetectorFormContext();
  const canEditDetector = useCanEditDetector({projectId: project.id, detectorType});

  return (
    <StyledProjectField
      inline={false}
      flexibleControlStateSize
      stacked
      projects={projects}
      groupProjects={p => (p.isMember ? 'member' : 'all')}
      groups={[
        {key: 'member', label: t('My Projects')},
        {key: 'all', label: t('All Projects')},
      ]}
      name="projectId"
      placeholder={t('Project')}
      aria-label={t('Select Project')}
      disabled={fetching}
      size="sm"
      validate={() => {
        if (!canEditDetector) {
          return [
            [
              'projectId',
              t('You do not have permission to create or edit monitors in this project'),
            ],
          ];
        }
        return [];
      }}
    />
  );
}

function EnvironmentField(props: Partial<React.ComponentProps<typeof SelectField>>) {
  const {projects} = useProjects();
  const projectId = useFormField<string>('projectId')!;

  const environments = projects.find(p => p.id === projectId)?.environments ?? [];

  return (
    <StyledEnvironmentField
      choices={[
        ['', t('All Environments')],
        ...(environments?.map(environment => [environment, environment]) ?? []),
      ]}
      inline={false}
      flexibleControlStateSize
      stacked
      name="environment"
      placeholder={t('Environment')}
      aria-label={t('Select Environment')}
      size="sm"
      {...props}
    />
  );
}

const StyledProjectField = styled(SentryProjectSelectorField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;

const StyledEnvironmentField = styled(SelectField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;
