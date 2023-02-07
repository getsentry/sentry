import {useRef} from 'react';
import pick from 'lodash/pick';

import {FieldFromConfig} from 'sentry/components/forms';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {Field} from 'sentry/components/forms/types';
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
  onCancel: FormProps['onCancel'];
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  organization: Organization;
  projects: Project[];
  repos: Repository[];
  existingConfig?: RepositoryProjectPathConfig;
};

function RepositoryProjectPathConfigForm({
  existingConfig,
  integration,
  onCancel,
  onSubmitSuccess,
  organization,
  projects,
  repos,
}: Props) {
  const formRef = useRef(new FormModel());
  const repoChoices = repos.map(({name, id, defaultBranch}) => ({
    value: id,
    label: name,
    defaultBranch,
  }));
  const formFields: Field[] = [
    {
      name: 'projectId',
      type: 'sentry_project_selector',
      required: true,
      label: t('Project'),
      projects,
    },
    {
      name: 'repositoryId',
      type: 'select_async',
      required: true,
      label: t('Repo'),
      placeholder: t('Choose repo'),
      url: `/organizations/${organization.slug}/repos/`,
      defaultOptions: repoChoices,
      onChange: (id: string) => {
        const repo = repos.find(r => r.id === id);
        if (repo?.defaultBranch) {
          // Automatically switch to the default branch for the repo
          formRef.current.setValue('defaultBranch', repo.defaultBranch);
        }
      },
    },
    {
      id: 'defaultBranch',
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

  function handlePreSubmit() {
    trackIntegrationAnalytics('integrations.stacktrace_submit_config', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: integration.provider.key,
      organization,
    });
  }

  const initialData = {
    defaultBranch: 'master',
    stackRoot: '',
    sourceRoot: '',
    repositoryId: existingConfig?.repoId,
    integrationId: integration.id,
    ...pick(existingConfig, ['projectId', 'defaultBranch', 'stackRoot', 'sourceRoot']),
  };

  // endpoint changes if we are making a new row or updating an existing one
  const baseEndpoint = `/organizations/${organization.slug}/code-mappings/`;
  const endpoint = existingConfig ? `${baseEndpoint}${existingConfig.id}/` : baseEndpoint;
  const apiMethod = existingConfig ? 'PUT' : 'POST';

  return (
    <Form
      onSubmitSuccess={onSubmitSuccess}
      onPreSubmit={handlePreSubmit}
      initialData={initialData}
      apiEndpoint={endpoint}
      apiMethod={apiMethod}
      model={formRef.current}
      onCancel={onCancel}
    >
      {formFields.map(field => (
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

export default RepositoryProjectPathConfigForm;
