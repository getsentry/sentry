import {Component} from 'react';
import pick from 'lodash/pick';

import {FieldFromConfig} from 'sentry/components/forms';
import Form from 'sentry/components/forms/form';
import {Field} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import {
  Integration,
  Organization,
  Project,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';

type Props = {
  integration: Integration;
  onCancel: Form['props']['onCancel'];
  onSubmitSuccess: Form['props']['onSubmitSuccess'];
  organization: Organization;
  projects: Project[];
  repos: Repository[];
  existingConfig?: RepositoryProjectPathConfig;
};

export default class RepositoryProjectPathConfigForm extends Component<Props> {
  get initialData() {
    const {existingConfig, integration} = this.props;
    return {
      defaultBranch: 'master',
      stackRoot: '',
      sourceRoot: '',
      repositoryId: existingConfig?.repoId,
      integrationId: integration.id,
      ...pick(existingConfig, ['projectId', 'defaultBranch', 'stackRoot', 'sourceRoot']),
    };
  }

  get formFields(): Field[] {
    const {projects, repos} = this.props;
    const repoChoices = repos.map(({name, id}) => ({value: id, label: name}));
    return [
      {
        name: 'projectId',
        type: 'sentry_project_selector',
        required: true,
        label: t('Project'),
        projects,
      },
      {
        name: 'repositoryId',
        type: 'select',
        required: true,
        label: t('Repo'),
        placeholder: t('Choose repo'),
        options: repoChoices,
      },
      {
        name: 'defaultBranch',
        type: 'string',
        required: true,
        label: t('Branch'),
        placeholder: t('Type your branch'),
        showHelpInTooltip: true,
        help: t(
          'If an event does not have a release tied to a commit, we will use this branch when linking to your source code.'
        ),
      },
      {
        name: 'stackRoot',
        type: 'string',
        required: false,
        label: t('Stack Trace Root'),
        placeholder: t('Type root path of your stack traces'),
        showHelpInTooltip: true,
        help: t(
          'Any stack trace starting with this path will be mapped with this rule. An empty string will match all paths.'
        ),
      },
      {
        name: 'sourceRoot',
        type: 'string',
        required: false,
        label: t('Source Code Root'),
        placeholder: t('Type root path of your source code, e.g. `src/`.'),
        showHelpInTooltip: true,
        help: t(
          'When a rule matches, the stack trace root is replaced with this path to get the path in your repository. Leaving this empty means replacing the stack trace root with an empty string.'
        ),
      },
    ];
  }

  handlePreSubmit() {
    trackIntegrationAnalytics('integrations.stacktrace_submit_config', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: this.props.integration.provider.key,
      organization: this.props.organization,
    });
  }

  render() {
    const {organization, onSubmitSuccess, onCancel, existingConfig} = this.props;

    // endpoint changes if we are making a new row or updating an existing one
    const baseEndpoint = `/organizations/${organization.slug}/code-mappings/`;
    const endpoint = existingConfig
      ? `${baseEndpoint}${existingConfig.id}/`
      : baseEndpoint;
    const apiMethod = existingConfig ? 'PUT' : 'POST';

    return (
      <Form
        onSubmitSuccess={onSubmitSuccess}
        onPreSubmit={() => this.handlePreSubmit()}
        initialData={this.initialData}
        apiEndpoint={endpoint}
        apiMethod={apiMethod}
        onCancel={onCancel}
      >
        {this.formFields.map(field => (
          <FieldFromConfig
            key={field.name}
            field={field}
            inline={false}
            stacked
            flexibleControlStateSize
          />
        ))}
      </Form>
    );
  }
}
