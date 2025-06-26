import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import EditableText from 'sentry/components/editableText';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import FormField from 'sentry/components/forms/formField';
import * as Layout from 'sentry/components/layouts/thirds';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useProjects from 'sentry/utils/useProjects';

export function DetectorBaseFields() {
  return (
    <Flex gap={space(1)} direction="column">
      <Layout.Title>
        <FormField name="name" inline={false} flexibleControlStateSize stacked>
          {({onChange, value}) => (
            <EditableText
              isDisabled={false}
              value={value || ''}
              onChange={newValue => {
                onChange(newValue, {
                  target: {
                    value: newValue,
                  },
                });
              }}
              errorMessage={t('Please set a title')}
              placeholder={t('New Monitor')}
            />
          )}
        </FormField>
      </Layout.Title>
      <Flex gap={space(1)}>
        <ProjectField />
        <EnvironmentField />
      </Flex>
    </Flex>
  );
}

function ProjectField() {
  const {projects, fetching} = useProjects();

  return (
    <StyledProjectField
      inline={false}
      flexibleControlStateSize
      stacked
      projects={projects}
      groupProjects={project => (project.isMember ? 'member' : 'all')}
      groups={[
        {key: 'member', label: t('My Projects')},
        {key: 'all', label: t('All Projects')},
      ]}
      name="projectId"
      placeholder={t('Project')}
      aria-label={t('Select Project')}
      disabled={fetching}
      size="sm"
    />
  );
}

function EnvironmentField() {
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
