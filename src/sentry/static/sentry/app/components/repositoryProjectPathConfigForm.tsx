import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {Project, Organization, Integration, Repository} from 'app/types';
import {JsonFormObject} from 'app/views/settings/components/forms/type';

type Props = {
  organization: Organization;
  integration: Integration;
  projects: Project[];
  repos: Repository[];
  onSubmitSuccess: Form['onSubmitSuccess'];
};

export default class RepositoryProjectPathConfigForm extends React.Component<Props> {
  get initialData() {
    return {
      defaultBranch: 'master',
      stackRoot: '',
      sourceRoot: '',
    };
  }

  get formFields(): JsonFormObject {
    const {projects, repos} = this.props;
    const repoChoices = repos.map(({name, id}) => ({value: id, label: name}));
    return {
      title: t('Create Code Path'),
      fields: [
        {
          name: 'projectId',
          type: 'sentry_project_selector',
          required: true,
          label: t('Project'),
          inline: false,
          projects,
        },
        {
          name: 'repositoryId',
          type: 'select',
          required: true,
          label: t('Repo'),
          inline: false,
          placeholder: t('Choose repo'),
          options: repoChoices,
        },
        {
          name: 'defaultBranch',
          type: 'string',
          required: true,
          label: t('Branch'),
          placeholder: t('Type your branch'),
          inline: false,
        },
        {
          name: 'stackRoot',
          type: 'string',
          required: false,
          label: t('Input Path'),
          placeholder: t('Type root path of your stack traces'),
          inline: false,
          showHelpInTooltip: true,
          help: t(
            'Any stack trace starting with this path will be mapped with this rule. An empty string will match all paths.'
          ),
        },
        {
          name: 'sourceRoot',
          type: 'string',
          required: false,
          label: t('Output Path'),
          placeholder: t('Type root path of your source code'),
          inline: false,
          showHelpInTooltip: true,
          help: t(
            'When a rule matches, the input path is replaced with this path to get the path in your repository. Leaving this empty means replacing the input path with an empty string.'
          ),
        },
      ],
    };
  }

  render() {
    const {organization, integration, onSubmitSuccess} = this.props;

    //TODO: make endpoint and method dynamic
    const endpoint = `/organizations/${organization.slug}/integrations/${integration.id}/repo-project-path-configs/`;
    const apiMethod = 'POST';

    return (
      <StyledForm
        onSubmitSuccess={onSubmitSuccess}
        initialData={this.initialData}
        apiEndpoint={endpoint}
        apiMethod={apiMethod}
      >
        <JsonForm forms={[this.formFields]} />
      </StyledForm>
    );
  }
}

const StyledForm = styled(Form)`
  label {
    color: ${p => p.theme.gray600};
    font-family: Rubik;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
  }
`;
