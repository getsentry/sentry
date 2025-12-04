import {useEffect, useRef, useState} from 'react';
import pick from 'lodash/pick';

import type {GeneralSelectValue} from 'sentry/components/core/select';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import type {Field} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';
import type {
  Integration,
  IntegrationRepository,
  Repository,
  RepositoryProjectPathConfig,
} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {sentryNameToOption} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';

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
  const repoChoices = repos.map(({name, id}) => ({value: id, label: name}));
  const [selectedRepo, setSelectedRepo] = useState<GeneralSelectValue | null>(null);

  /**
   * Using the integration repo search, automatically switch to the default branch for the repo,
   * once one is selected in the form.
   */
  const {data: integrationReposData} = useApiQuery<{repos: IntegrationRepository[]}>(
    [
      `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      {query: {search: selectedRepo?.label}},
    ],
    {
      enabled: !!selectedRepo?.label,
      staleTime: 1000 * 60 * 5,
    }
  );

  // Stream-based VCS (like Perforce) use streams/codelines instead of branches
  // and don't require a default branch to be specified
  const isStreamBased = integration.provider.key === 'perforce';

  // Effect to handle the case when integration repos data becomes available
  useEffect(() => {
    if (integrationReposData?.repos && selectedRepo) {
      const {defaultBranch} =
        integrationReposData.repos.find(r => r.identifier === selectedRepo.label) ?? {};
      const isCurrentRepo =
        formRef.current.getValue('repositoryId') === selectedRepo.value;
      if (defaultBranch && isCurrentRepo) {
        formRef.current.setValue('defaultBranch', defaultBranch);
      }
    }
  }, [integrationReposData, selectedRepo]);

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
      onResults: results => results.map(sentryNameToOption),
      onChangeOption: setSelectedRepo,
    },
    {
      name: 'defaultBranch',
      type: 'string',
      required: !isStreamBased,
      label: isStreamBased ? t('Stream') : t('Branch'),
      placeholder: isStreamBased
        ? t('Type your stream (optional, e.g., main)')
        : t('Type your branch'),
      showHelpInTooltip: true,
      help: isStreamBased
        ? t(
            'Optional: Specify a stream/codeline (e.g., "main"). If not specified, the depot root will be used. Streams are part of the depot path in Perforce.'
          )
        : t(
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
    trackAnalytics('integrations.stacktrace_submit_config', {
      setup_type: 'manual',
      view: 'integration_configuration_detail',
      provider: integration.provider.key,
      organization,
    });
  }

  const initialData = {
    defaultBranch: isStreamBased ? '' : 'main',
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
