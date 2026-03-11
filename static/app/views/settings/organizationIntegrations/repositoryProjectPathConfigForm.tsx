import * as Sentry from '@sentry/react';
import {useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {IdBadge} from 'sentry/components/idBadge';
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
import {apiOptions} from 'sentry/utils/api/apiOptions';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';

type Props = ModalRenderProps & {
  integration: Integration;
  organization: Organization;
  projects: Project[];
  repos: Repository[];
  existingConfig?: RepositoryProjectPathConfig;
};

const integrationReposOptions = (
  orgSlug: string,
  integrationId: string,
  search: string
) =>
  apiOptions.as<{repos: IntegrationRepository[]}>()(
    '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
    {
      path: {organizationIdOrSlug: orgSlug, integrationId},
      query: {search},
      staleTime: 1000 * 60 * 5,
    }
  );

export default function RepositoryProjectPathConfigModal({
  Body,
  Footer,
  Header,
  closeModal,
  existingConfig,
  integration,
  organization,
  projects,
  repos,
}: Props) {
  const queryClient = useQueryClient();

  const isStreamBased = integration.provider.key === 'perforce';

  const schema = z.object({
    projectId: z.string().min(1, t('Project is required')),
    repositoryId: z.string().min(1, t('Repository is required')),
    defaultBranch: isStreamBased
      ? z.string()
      : z.string().min(1, t('Branch is required')),
    stackRoot: z.string(),
    sourceRoot: z.string(),
    integrationId: z.string(),
  });

  const projectOptions = projects.map(project => ({
    value: project.id,
    label: project.slug,
    leadingItems: (
      <IdBadge
        project={project}
        avatarSize={20}
        avatarProps={{consistentWidth: true}}
        hideName
      />
    ),
  }));
  const repoOptions = repos.map(({name, id}) => ({value: id, label: name}));

  const endpoint = existingConfig
    ? getApiUrl(`/organizations/$organizationIdOrSlug/code-mappings/$configId/`, {
        path: {organizationIdOrSlug: organization.slug, configId: existingConfig.id},
      })
    : getApiUrl(`/organizations/$organizationIdOrSlug/code-mappings/`, {
        path: {organizationIdOrSlug: organization.slug},
      });

  const mutation = useMutation({
    mutationFn: (data: Partial<RepositoryProjectPathConfig>) =>
      fetchMutation({
        method: existingConfig ? 'PUT' : 'POST',
        url: endpoint,
        data,
      }),
    onError: e => {
      Sentry.captureException(e);
      addErrorMessage(t('Failed to configure code path mapping'));
    },
    onSuccess: () => {
      trackAnalytics('integrations.stacktrace_complete_setup', {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: integration.provider.key,
        organization,
      });
      closeModal();
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {
      projectId: existingConfig?.projectId ?? '',
      repositoryId: existingConfig?.repoId ?? '',
      defaultBranch: existingConfig?.defaultBranch ?? (isStreamBased ? '' : 'main'),
      stackRoot: existingConfig?.stackRoot ?? '',
      sourceRoot: existingConfig?.sourceRoot ?? '',
      integrationId: integration.id,
    },
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      trackAnalytics('integrations.stacktrace_submit_config', {
        setup_type: 'manual',
        view: 'integration_configuration_detail',
        provider: integration.provider.key,
        organization,
      });
      return mutation.mutateAsync(value).catch(() => {});
    },
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <h4>{t('Configure code path mapping')}</h4>
      </Header>
      <Body>
        <Stack gap="xl">
          <form.AppField name="projectId">
            {field => (
              <field.Layout.Stack label={t('Project')} required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('Choose Sentry project')}
                  options={projectOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField
            name="repositoryId"
            listeners={{
              onChange: async ({value}) => {
                const repoLabel = repoOptions.find(opt => opt.value === value)?.label;
                if (!repoLabel) {
                  return;
                }

                // If the default branch field has been blurred (i.e., the user has interacted with it),
                // do not auto-update its value when the repo changes, to avoid overwriting user input.
                if (form.getFieldMeta('defaultBranch')?.isBlurred) {
                  return;
                }

                try {
                  const data = await queryClient.fetchQuery(
                    integrationReposOptions(organization.slug, integration.id, repoLabel)
                  );
                  const defaultBranch = data.json.repos.find(
                    r => r.identifier === repoLabel
                  )?.defaultBranch;
                  if (defaultBranch) {
                    form.setFieldValue('defaultBranch', defaultBranch);
                  }
                } catch {
                  // If the fetch fails, keep the current default branch value
                }
              },
            }}
          >
            {field => (
              <field.Layout.Stack label={t('Repo')} required>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('Choose repo')}
                  options={repoOptions}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="defaultBranch">
            {field => (
              <field.Layout.Stack
                label={isStreamBased ? t('Stream') : t('Branch')}
                hintText={
                  isStreamBased
                    ? t(
                        'Optional: Specify a stream/codeline (e.g., "main"). If not specified, the depot root will be used. Streams are part of the depot path in Perforce.'
                      )
                    : t(
                        'If an event does not have a release tied to a commit, we will use this branch when linking to your source code.'
                      )
                }
                variant="compact"
                required={!isStreamBased}
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={
                    isStreamBased
                      ? t('Type your stream (optional, e.g., main)')
                      : t('Type your branch')
                  }
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="stackRoot">
            {field => (
              <field.Layout.Stack
                label={t('Stack Trace Root')}
                hintText={t(
                  'Any stack trace starting with this path will be mapped with this rule. An empty string will match all paths.'
                )}
                variant="compact"
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('Type root path of your stack traces')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>

          <form.AppField name="sourceRoot">
            {field => (
              <field.Layout.Stack
                label={t('Source Code Root')}
                hintText={t(
                  'When a rule matches, the stack trace root is replaced with this path to get the path in your repository. Leaving this empty means replacing the stack trace root with an empty string.'
                )}
                variant="compact"
              >
                <field.Input
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder={t('Type root path of your source code, e.g. `src/`.')}
                />
              </field.Layout.Stack>
            )}
          </form.AppField>
        </Stack>
      </Body>
      <Footer>
        <Flex justify="end" gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>{t('Save Changes')}</form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}
