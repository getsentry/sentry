import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {fetchMutation, useQuery} from 'sentry/utils/queryClient';
import {useInfiniteQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useAgentOptions} from 'sentry/views/settings/seer/seerAgentHooks';

export function useAutofixOverviewData() {
  const organization = useOrganization();

  const autofixSettingsResult = useInfiniteQuery({
    ...bulkAutofixAutomationSettingsInfiniteOptions({organization}),
    select: ({pages}) => {
      const autofixItems = pages.flatMap(page => page.json).filter(s => s !== null);
      const projectsWithRepos = autofixItems.filter(settings => settings.reposCount > 0);
      const projectsWithPreferredAgent =
        organization.defaultCodingAgent === 'seer'
          ? autofixItems.filter(settings => !settings.automationHandoff)
          : autofixItems.filter(
              settings =>
                String(settings.automationHandoff?.integration_id ?? '') ===
                String(organization.defaultCodingAgentIntegrationId ?? '')
            );

      const projectsWithCreatePr = organization.autoOpenPrs
        ? autofixItems.filter(
            settings =>
              (settings.automationHandoff === null &&
                settings.automatedRunStoppingPoint === 'open_pr') ||
              settings.automationHandoff?.auto_create_pr
          )
        : autofixItems.filter(
            settings =>
              settings.automatedRunStoppingPoint !== 'open_pr' &&
              !settings.automationHandoff?.auto_create_pr
          );

      return {
        projectsWithRepos,
        projectsWithPreferredAgent,
        projectsWithCreatePr,
      };
    },
  });
  useFetchAllPages({result: autofixSettingsResult});
  return autofixSettingsResult;
}

type Props = ReturnType<typeof useAutofixOverviewData> & {
  canWrite: boolean;
  organization: Organization;
};

export function AutofixOverviewSection({canWrite, data, isPending, organization}: Props) {
  const {projects} = useProjects();

  const {projectsWithPreferredAgent = [], projectsWithCreatePr = []} = data ?? {};

  return (
    <FieldGroup
      title={
        <Flex justify="between" gap="md" flexGrow={1}>
          <span>{t('Autofix')}</span>
          <Text uppercase={false}>
            <Link to={`/settings/${organization.slug}/seer/projects/`}>
              <Flex align="center" gap="xs">
                {t('Configure')} <IconSettings size="xs" />
              </Flex>
            </Link>
          </Text>
        </Flex>
      }
    >
      <AgentNameForm
        canWrite={canWrite}
        isPending={isPending}
        organization={organization}
        projects={projects}
        projectsWithPreferredAgentCount={projectsWithPreferredAgent.length}
      />

      <CreatePrForm
        canWrite={canWrite}
        isPending={isPending}
        organization={organization}
        projects={projects}
        projectsWithCreatePrCount={projectsWithCreatePr.length}
      />
    </FieldGroup>
  );
}

function AgentNameForm({
  canWrite,
  organization,
  projects,
  projectsWithPreferredAgentCount,
}: {
  canWrite: boolean;
  isPending: boolean;
  organization: Organization;
  projects: Project[];
  projectsWithPreferredAgentCount: number;
}) {
  const {data: integrations} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );
  const rawAgentOptions = useAgentOptions({
    integrations: integrations?.integrations ?? [],
  }).filter(option => option.value !== 'none');
  const codingAgentOptions = rawAgentOptions.map(option => ({
    value: option.value === 'seer' ? 'seer' : String(option.value.id),
    label: option.label,
  }));

  const codingAgentMutationOpts = mutationOptions({
    mutationFn: ({agentId}: {agentId: string}) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          agentId === 'seer'
            ? {
                defaultCodingAgent: agentId,
                defaultCodingAgentIntegrationId: null,
              }
            : {
                defaultCodingAgent: rawAgentOptions
                  .filter(option => option.value !== 'seer')
                  .find(option => option.value.id === agentId)?.value.provider,
                defaultCodingAgentIntegrationId: agentId,
              },
      });
    },
    onSuccess: updateOrganization,
  });

  const preferredAgentValue = organization.defaultCodingAgentIntegrationId
    ? String(organization.defaultCodingAgentIntegrationId)
    : organization.defaultCodingAgent
      ? organization.defaultCodingAgent
      : 'seer';

  const preferredAgentLabel = codingAgentOptions.find(
    option => option.value === preferredAgentValue
  )?.label;

  return (
    <AutoSaveForm
      name="agentId"
      schema={z.object({agentId: z.string()})}
      initialValue={preferredAgentValue}
      mutationOptions={codingAgentMutationOpts}
    >
      {field => (
        <Stack gap="md">
          <field.Layout.Row
            label={t('Default Preferred Coding Agent')}
            hintText={t(
              'For new projects, select which coding agent to use when proposing code changes.'
            )}
          >
            <Container flexGrow={1}>
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                disabled={!canWrite}
                options={codingAgentOptions}
              />
            </Container>
          </field.Layout.Row>

          <Flex align="center" alignSelf="end" gap="md" width="50%" paddingLeft="xl">
            <Text variant="secondary" size="sm">
              {projects.length === 0
                ? t('No projects found')
                : projects.length === 1
                  ? projectsWithPreferredAgentCount === 1
                    ? t('Your existing project uses %s', preferredAgentLabel)
                    : t('Your existing project does not use %s', preferredAgentLabel)
                  : projects.length === projectsWithPreferredAgentCount
                    ? t('All existing projects use %s', preferredAgentLabel)
                    : t(
                        '%s of %s existing projects use %s',
                        projectsWithPreferredAgentCount,
                        projects.length,
                        preferredAgentLabel
                      )}
            </Text>
          </Flex>
        </Stack>
      )}
    </AutoSaveForm>
  );
}

function CreatePrForm({
  canWrite,
  organization,
  projects,
  projectsWithCreatePrCount,
}: {
  canWrite: boolean;
  isPending: boolean;
  organization: Organization;
  projects: Project[];
  projectsWithCreatePrCount: number;
}) {
  const orgMutationOpts = mutationOptions({
    mutationFn: (updateData: Partial<Organization>) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data: updateData,
      }),
    onSuccess: updateOrganization,
  });

  return (
    <AutoSaveForm
      name="autoOpenPrs"
      schema={z.object({autoOpenPrs: z.boolean()})}
      initialValue={organization.autoOpenPrs ?? false}
      mutationOptions={orgMutationOpts}
    >
      {field => (
        <Stack gap="md">
          <field.Layout.Row
            label={t('Create PRs by default')}
            hintText={tct('For new projects, create a PR when proposing a code change.', {
              docs: (
                <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
              ),
            })}
          >
            <Container flexGrow={1}>
              <field.Switch
                checked={
                  organization.enableSeerCoding === false ? false : field.state.value
                }
                onChange={field.handleChange}
                disabled={
                  organization.enableSeerCoding === false
                    ? t('Enable Code Generation to allow Autofix to create PRs.')
                    : !canWrite
                }
              />
            </Container>
          </field.Layout.Row>

          <Flex align="center" alignSelf="end" gap="md" width="50%" paddingLeft="xl">
            <Text variant="secondary" size="sm">
              {projects.length === 0
                ? t('No projects found')
                : projects.length === 1
                  ? projectsWithCreatePrCount === 1
                    ? t('Your existing project has Create PR enabled')
                    : t('Your existing project does not have Create PR enabled')
                  : field.state.value
                    ? projects.length === projectsWithCreatePrCount
                      ? t('All existing projects have Create PR enabled')
                      : t(
                          '%s of %s existing projects have Create PR enabled',
                          projectsWithCreatePrCount,
                          projects.length
                        )
                    : projects.length === projectsWithCreatePrCount
                      ? t('All existing projects have Create PR disabled')
                      : t(
                          '%s of %s existing projects have Create PR disabled',
                          projectsWithCreatePrCount,
                          projects.length
                        )}
            </Text>
          </Flex>

          {organization.enableSeerCoding === false && (
            <Alert variant="warning">
              {tct(
                '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                {
                  settings: (
                    <Link to={`/settings/${organization.slug}/seer/#enableSeerCoding`} />
                  ),
                }
              )}
            </Alert>
          )}
        </Stack>
      )}
    </AutoSaveForm>
  );
}
