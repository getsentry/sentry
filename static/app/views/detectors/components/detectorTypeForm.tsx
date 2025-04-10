import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {DebugForm} from 'sentry/components/workflowEngine/form/debug';
import {useFormField} from 'sentry/components/workflowEngine/form/hooks';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Environment} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

const model = new FormModel({
  initialData: {
    project: undefined,
    environment: 'all',
    type: 'metric',
  },
});

export function DetectorTypeForm() {
  const {projects} = useProjects();

  useEffect(() => {
    const firstProject = projects.find(p => p.isMember);
    model.setInitialData({
      project: firstProject?.id,
      environment: 'all',
      type: 'metric',
    });
    const prevHook = model.options.onFieldChange;
    model.setFormOptions({
      onFieldChange(id, value) {
        if (id === 'project') {
          model.setValue('environment', 'all');
        }
        prevHook?.(id, value);
      },
    });
  }, [projects]);

  return (
    <Form hideFooter model={model}>
      <Flex column>
        <Group column>
          <Header column>
            <h3>{t('Project and Environment')}</h3>
          </Header>
          <Flex>
            <ProjectField />
            <EnvironmentField />
          </Flex>
        </Group>
        <Group column>
          <Header column>
            <h3>{t('Monitor type')}</h3>
            <p>
              {t("Monitor type can't be edited once the monitor has been created.")}{' '}
              <a href="#">{t('Learn more about monitor types.')}</a>
            </p>
          </Header>
          <MonitorTypeField />
          <DebugForm />
        </Group>
      </Flex>
    </Form>
  );
}

function ProjectField() {
  const {projects} = useProjects();

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
      name="project"
      placeholder={t('Project')}
    />
  );
}

function EnvironmentField() {
  const project = useFormField('project');
  const {environments} = useProjectEnvironments({projectSlug: project?.toString()});
  return (
    <StyledEnvironmentField
      choices={[
        ['all', t('All Environments')],
        ...(environments?.map(environment => [environment.id, environment.name]) ?? []),
      ]}
      inline={false}
      flexibleControlStateSize
      stacked
      name="environment"
      placeholder={t('Environment')}
    />
  );
}

function MonitorTypeField() {
  return (
    <StyledRadioField
      inline={false}
      flexibleControlStateSize
      name="type"
      choices={[
        ['metric', 'Metric', 'Monitor error counts, transaction duration, and more!'],
        [
          'crons',
          'Crons',
          'Monitor the uptime and performance of any scheduled, recurring jobs.',
        ],
        [
          'uptime',
          'Uptime',
          'Monitor the uptime of specific endpoint in your applications.',
        ],
      ]}
    />
  );
}

function useProjectEnvironments({projectSlug}: {projectSlug?: string}) {
  const organization = useOrganization();
  const {data: environments = [], isLoading} = useApiQuery<Environment[]>(
    [
      `/projects/${organization.slug}/${projectSlug}/environments/`,
      {query: {visibility: 'visible'}},
    ],
    {
      staleTime: 30_000,
    }
  );
  return {environments, isLoading};
}

const StyledProjectField = styled(SentryProjectSelectorField)`
  flex-grow: 1;
  max-width: 360px;
  padding-left: 0;
`;

const StyledEnvironmentField = styled(SelectField)`
  flex-grow: 1;
  max-width: 360px;
  padding-left: 0;
`;

const StyledRadioField = styled(RadioField)`
  flex-grow: 1;
  padding-left: 0;

  label {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    padding: ${space(2)} ${space(1)};
    border-radius: ${p => p.theme.borderRadius};
    border: 1px solid ${p => p.theme.border};

    &:empty {
      display: none;
    }

    div:empty {
      display: none;
    }

    &[aria-checked='true'] {
      border-color: ${p => p.theme.focusBorder};
      outline: solid 1px ${p => p.theme.focusBorder};
    }

    input[type='radio'] {
      clip: rect(0 0 0 0);
      clip-path: inset(50%);
      height: 1px;
      overflow: hidden;
      position: absolute;
      white-space: nowrap;
      width: 1px;
    }
  }
`;

const Group = styled(Flex)`
  padding-inline: ${space(4)};
`;

const Header = styled(Flex)`
  gap: ${space(0.5)};
  margin-top: ${space(3)};
  margin-bottom: ${space(1)};

  h3 {
    margin: 0;
    font-size: ${p => p.theme.fontSizeLarge};
  }
  p {
    margin: 0;
  }
`;
