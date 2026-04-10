import {useState} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {
  bulkAutofixAutomationSettingsInfiniteOptions,
  type AutofixAutomationSettings,
} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {type CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useInfiniteQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  getPreferredAgentMutationOptions,
  useFetchPreferredAgent,
  useFetchAgentOptions,
  useBulkMutateSelectedAgent,
} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';
import {useBulkMutateCreatePr} from 'sentry/views/settings/seer/seerAgentHooks';

import {
  getDefaultStoppingPointMutationOptions,
  getDefaultStoppingPointValue,
  useFetchStoppingPointOptions,
} from './utils/seerStoppingPoint';

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
  const projectsIdsWithPreferredAgent = new Set(
    projectsWithPreferredAgent.map(s => s.projectId)
  );

  const [isBulkMutatingAgent, setIsBulkMutatingAgent] = useState(false);
  const [isBulkMutatingCreatePr, setIsBulkMutatingCreatePr] = useState(false);

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
        isBulkMutatingAgent={isBulkMutatingAgent}
        setIsBulkMutatingAgent={setIsBulkMutatingAgent}
        isBulkMutatingCreatePr={isBulkMutatingCreatePr}
        organization={organization}
        projects={projects}
        projectsIdsWithPreferredAgent={projectsIdsWithPreferredAgent}
      />

      <CreatePrForm
        canWrite={canWrite}
        isPending={isPending}
        isBulkMutatingCreatePr={isBulkMutatingCreatePr}
        setIsBulkMutatingCreatePr={setIsBulkMutatingCreatePr}
        isBulkMutatingAgent={isBulkMutatingAgent}
        organization={organization}
        projects={projects}
        projectsWithCreatePr={projectsWithCreatePr}
      />

      <StoppingPointForm organization={organization} canWrite={canWrite} />
    </FieldGroup>
  );
}

function AgentNameForm({
  canWrite,
  isPending,
  isBulkMutatingAgent,
  setIsBulkMutatingAgent,
  isBulkMutatingCreatePr,
  organization,
  projects,
  projectsIdsWithPreferredAgent,
}: {
  canWrite: boolean;
  isBulkMutatingAgent: boolean;
  isBulkMutatingCreatePr: boolean;
  isPending: boolean;
  organization: Organization;
  projects: Project[];
  projectsIdsWithPreferredAgent: Set<string>;
  setIsBulkMutatingAgent: (value: boolean) => void;
}) {
  const preferredAgent = useFetchPreferredAgent({organization});
  const codingAgentSelectOptions = useFetchAgentOptions({organization});
  const codingAgentMutationOptions = getPreferredAgentMutationOptions({organization});
  const bulkMutateSelectedAgent = useBulkMutateSelectedAgent();

  const preferredAgentLabel = codingAgentSelectOptions.data?.find(
    o => o.value === preferredAgent.data
  )?.label;

  const initialValue = preferredAgent.data ? preferredAgent.data : ('seer' as const);

  return (
    <AutoSaveForm
      name="integration"
      schema={z.object({
        integration: z.union([z.literal('seer'), z.custom<CodingAgentIntegration>()]),
      })}
      initialValue={initialValue}
      mutationOptions={codingAgentMutationOptions}
    >
      {field => (
        <Stack gap="md">
          <field.Layout.Row
            label={t('Default Preferred Coding Agent')}
            hintText={
              <Text>
                {tct(
                  'For new projects, select which coding agent to use when proposing code changes. [manageLink:Manage Coding Agent Integrations]',
                  {
                    manageLink: (
                      <Link
                        to={{
                          pathname: `/settings/${organization.slug}/integrations/`,
                          query: {category: 'coding agent'},
                        }}
                      >
                        {t('Manage Coding Agent Integrations')}
                      </Link>
                    ),
                  }
                )}
              </Text>
            }
          >
            <Container flexGrow={1}>
              {preferredAgent.isPending || codingAgentSelectOptions.isPending ? (
                <Placeholder height="36px" width="100%" />
              ) : codingAgentSelectOptions.isError ? (
                <Alert variant="danger">
                  {t('Failed to fetch coding agent options')}
                </Alert>
              ) : (
                <field.Select
                  value={field.state.value as CodingAgentIntegration | 'seer'}
                  onChange={field.handleChange}
                  disabled={!canWrite}
                  options={codingAgentSelectOptions.data}
                  isValueEqual={(a, b) =>
                    a === b ||
                    (typeof a === 'object' && typeof b === 'object' && a.id === b.id)
                  }
                />
              )}
            </Container>
          </field.Layout.Row>

          <Flex align="center" alignSelf="end" gap="md" width="50%" paddingLeft="xl">
            <Button
              size="xs"
              busy={isPending || isBulkMutatingAgent}
              disabled={
                !canWrite ||
                isBulkMutatingAgent ||
                isBulkMutatingCreatePr ||
                preferredAgent.isPending ||
                codingAgentSelectOptions.isPending ||
                projectsIdsWithPreferredAgent.size === projects.length
              }
              onClick={async () => {
                if (preferredAgent.data) {
                  setIsBulkMutatingAgent(true);
                  await bulkMutateSelectedAgent(
                    projects.filter(p => !projectsIdsWithPreferredAgent.has(p.id)),
                    preferredAgent.data
                  );
                  setIsBulkMutatingAgent(false);
                } else {
                  addErrorMessage(t('No coding agent integration found'));
                }
              }}
            >
              {tn(
                'Set for the existing project',
                'Set for all existing projects',
                projectsIdsWithPreferredAgent.size
              )}
            </Button>
            {preferredAgentLabel ? (
              <Text variant="secondary" size="sm">
                {projects.length === 0
                  ? t('No projects found')
                  : projects.length === 1
                    ? projectsIdsWithPreferredAgent.size === 1
                      ? t('Your existing project uses %s', preferredAgentLabel)
                      : t('Your existing project does not use %s', preferredAgentLabel)
                    : projects.length === projectsIdsWithPreferredAgent.size
                      ? t('All existing projects use %s', preferredAgentLabel)
                      : t(
                          '%s of %s existing projects use %s',
                          projectsIdsWithPreferredAgent.size,
                          projects.length,
                          preferredAgentLabel
                        )}
              </Text>
            ) : null}
          </Flex>
        </Stack>
      )}
    </AutoSaveForm>
  );
}

function CreatePrForm({
  canWrite,
  isPending,
  isBulkMutatingCreatePr,
  setIsBulkMutatingCreatePr,
  isBulkMutatingAgent,
  organization,
  projects,
  projectsWithCreatePr,
}: {
  canWrite: boolean;
  isBulkMutatingAgent: boolean;
  isBulkMutatingCreatePr: boolean;
  isPending: boolean;
  organization: Organization;
  projects: Project[];
  projectsWithCreatePr: AutofixAutomationSettings[];
  setIsBulkMutatingCreatePr: (value: boolean) => void;
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

  const projectsWithCreatePrIds = new Set(projectsWithCreatePr.map(s => s.projectId));
  const projectsToUpdate = projects.filter(p => !projectsWithCreatePrIds.has(p.id));

  const bulkMutateCreatePr = useBulkMutateCreatePr({projects: projectsToUpdate});

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
            <Button
              size="xs"
              busy={isPending || isBulkMutatingCreatePr}
              disabled={
                !canWrite ||
                isBulkMutatingCreatePr ||
                isBulkMutatingAgent ||
                organization.enableSeerCoding === false ||
                projectsWithCreatePr.length === projects.length
              }
              onClick={async () => {
                setIsBulkMutatingCreatePr(true);
                await bulkMutateCreatePr(field.state.value, {});
                setIsBulkMutatingCreatePr(false);
              }}
            >
              {field.state.value
                ? tn(
                    'Enable for the existing project',
                    'Enable for all existing projects',
                    projectsWithCreatePr.length
                  )
                : tn(
                    'Disable for the existing project',
                    'Disable for all existing projects',
                    projectsWithCreatePr.length
                  )}
            </Button>
            <Text variant="secondary" size="sm">
              {projects.length === 0
                ? t('No projects found')
                : projects.length === 1
                  ? projectsWithCreatePr.length === 1
                    ? t('Your existing project has Create PR enabled')
                    : t('Your existing project does not have Create PR enabled')
                  : field.state.value
                    ? projects.length === projectsWithCreatePr.length
                      ? t('All existing projects have Create PR enabled')
                      : t(
                          '%s of %s existing projects have Create PR enabled',
                          projectsWithCreatePr.length,
                          projects.length
                        )
                    : projects.length === projectsWithCreatePr.length
                      ? t('All existing projects have Create PR disabled')
                      : t(
                          '%s of %s existing projects have Create PR disabled',
                          projectsWithCreatePr.length,
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

function StoppingPointForm({
  organization,
  canWrite,
}: {
  canWrite: boolean;
  organization: Organization;
}) {
  const stoppingPointMutationOpts = getDefaultStoppingPointMutationOptions({
    organization,
  });

  const initialValue = getDefaultStoppingPointValue(organization);
  const preferredAgent = useFetchPreferredAgent({organization});
  const options = useFetchStoppingPointOptions({
    agent: preferredAgent.data,
    organization,
  });

  return (
    <AutoSaveForm
      name="stoppingPoint"
      schema={z.object({
        stoppingPoint: z.enum(['off', 'root_cause', 'code']),
      })}
      initialValue={initialValue}
      mutationOptions={stoppingPointMutationOpts}
    >
      {field => (
        <Stack gap="md">
          <field.Layout.Row
            label={t('Default Automation Steps')}
            hintText={tct(
              'For new projects, pick which steps Seer should run as new issues are collected. Depending on how [actionable:actionable] the issue is, Seer may stop at an earlier step.',
              {
                actionable: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                ),
              }
            )}
          >
            <Container flexGrow={1}>
              <field.Select
                disabled={!canWrite}
                value={field.state.value}
                onChange={field.handleChange}
                options={options}
              />
            </Container>
          </field.Layout.Row>
        </Stack>
      )}
    </AutoSaveForm>
  );
}
