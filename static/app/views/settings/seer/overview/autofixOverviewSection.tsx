import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {
  AutoSaveForm,
  defaultFormOptions,
  FieldGroup,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {ScmRepoTreeModal} from 'sentry/components/repositories/scmRepoTreeModal';
import {IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
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

      console.log({autoOpenPrs: organization.autoOpenPrs, autofixItems});

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
      console.log({projectsWithCreatePr});

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

  const {
    projectsWithRepos = [],
    projectsWithPreferredAgent = [],
    projectsWithCreatePr = [],
  } = data ?? {};

  const projectsWithReposCount = projectsWithRepos.length;

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
      <ConnectedReposForm
        projects={projects}
        projectsWithReposCount={projectsWithReposCount}
      />

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

      <StoppingPointForm organization={organization} />
    </FieldGroup>
  );
}

function ConnectedReposForm({
  projects,
  projectsWithReposCount,
}: {
  projects: Project[];
  projectsWithReposCount: number;
}) {
  const form = useScrapsForm(defaultFormOptions);

  return (
    <form.AppForm form={form}>
      <form.AppField name="placeholder">
        {field => (
          <Stack gap="md">
            <field.Layout.Row
              label={t('Projects with connected repos')}
              hintText={t(
                'Projects must be connected to a repo in order for Autofix to collect context and debug issues.'
              )}
            >
              <Container flexGrow={1}>
                <Button
                  priority="primary"
                  size="sm"
                  onClick={() => {
                    openModal(
                      deps => (
                        <ScmRepoTreeModal {...deps} title={t('Install Integration')} />
                      ),
                      {
                        modalCss: css`
                          width: 700px;
                        `,
                        // onClose: refetchIntegrations,
                      }
                    );
                  }}
                >
                  {t('Connect Projects and Repos')}
                </Button>
              </Container>
            </field.Layout.Row>

            <Flex align="center" alignSelf="end" gap="md" width="50%" paddingLeft="xl">
              <Text variant="secondary" size="sm">
                {projects.length === 0
                  ? t('No projects found')
                  : projects.length === 1
                    ? projectsWithReposCount === 1
                      ? t('Your existing project has repos connected')
                      : t('Your existing project does not have any repos connected')
                    : projects.length === projectsWithReposCount
                      ? t('All existing projects have repos connected')
                      : t(
                          '%s of %s existing projects have repos connected',
                          projectsWithReposCount,
                          projects.length
                        )}
              </Text>
            </Flex>
          </Stack>
        )}
      </form.AppField>
    </form.AppForm>
  );
}

function AgentNameForm({
  canWrite,
  isPending,
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
  });
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
            <Button
              size="xs"
              busy={isPending}
              disabled={!canWrite || projectsWithPreferredAgentCount === projects.length}
              onClick={() => {
                // TODO
              }}
            >
              {tn(
                'Set for the existing project',
                'Set for all existing projects',
                projectsWithPreferredAgentCount
              )}
            </Button>
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
  isPending,
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
            <Button
              size="xs"
              busy={isPending}
              disabled={
                !canWrite ||
                organization.enableSeerCoding === false ||
                projectsWithCreatePrCount === projects.length
              }
              onClick={() => {
                // TODO
              }}
            >
              {field.state.value
                ? tn(
                    'Enable for the existing project',
                    'Enable for all existing projects',
                    projectsWithCreatePrCount
                  )
                : tn(
                    'Disable for the existing project',
                    'Disable for all existing projects',
                    projectsWithCreatePrCount
                  )}
            </Button>
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

function StoppingPointForm({organization}: {organization: Organization}) {
  const stoppingPointMutationOpts = mutationOptions({
    mutationFn: ({
      stoppingPoint,
    }: {
      stoppingPoint:
        | 'off'
        | Organization['defaultAutomatedRunStoppingPoint'][keyof Organization['defaultAutomatedRunStoppingPoint']];
    }) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          stoppingPoint === 'off'
            ? {
                defaultAutofixAutomationTuning: 'off',
                defaultAutomatedRunStoppingPoint: null,
              }
            : {
                defaultAutofixAutomationTuning: 'medium',
                defaultAutomatedRunStoppingPoint: stoppingPoint,
              },
      });
    },
    onSuccess: updateOrganization,
  });

  const initialValue =
    organization.defaultAutofixAutomationTuning === 'off'
      ? 'off'
      : (organization.defaultAutomatedRunStoppingPoint ?? 'off');

  return (
    <AutoSaveForm
      name="stoppingPoint"
      schema={z.object({
        stoppingPoint: z.enum([
          'off',
          'root_cause',
          'solution',
          'code_changes',
          'open_pr',
        ]),
      })}
      initialValue={initialValue}
      mutationOptions={stoppingPointMutationOpts}
    >
      {field => (
        <Stack gap="md">
          <field.Layout.Row
            label={t('Default Automation Steps')}
            hintText={tct(
              'For new projects, pick which steps Seer should try to run as new issues are collected. Depending on how [actionable:actionable] the issue is, Seer may stop at an earlier step.',
              {
                actionable: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                ),
              }
            )}
          >
            <Container flexGrow={1}>
              {/* {false && (
                  <field.Select
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={
                      organization.autoOpenPrs
                        ? [
                            {value: 'off', label: t('No Automation')},
                            {
                              value: 'root_cause',
                              label: t('Automate Root Cause Analysis'),
                            },
                            {
                              value: 'open_pr',
                              label: t('Automate Code Changes and Create PR'),
                            },
                          ]
                        : [
                            {value: 'off', label: t('No Automation')},
                            {
                              value: 'root_cause',
                              label: t('Automate Root Cause Analysis'),
                            },
                            {value: 'code_changes', label: t('Automate Code Changes')},
                          ]
                    }
                  />
                )}
                  */}

              <field.Base<HTMLInputElement>>
                {(baseProps, {indicator}) => (
                  <Flex flexGrow={1} align="center" gap="lg" justify="between">
                    <StoppingPointContainer
                      flexGrow={1}
                      gap="md"
                      justify="between"
                      selectedValue={field.state.value}
                    >
                      <StoppingPointLabel as="label" align="center" gap="xs">
                        <Radio
                          {...baseProps}
                          value="off"
                          checked={field.state.value === 'off'}
                          onChange={() => field.handleChange('off')}
                        />
                        <Text size="sm" bold={false}>
                          {t('No Automation')}
                        </Text>
                      </StoppingPointLabel>
                      <StoppingPointLabel as="label" align="center" gap="xs">
                        <Radio
                          {...baseProps}
                          value="root_cause"
                          checked={field.state.value === 'root_cause'}
                          onChange={() => field.handleChange('root_cause')}
                        />
                        <Text size="sm" bold={false}>
                          {t('Root Cause Analysis')}
                        </Text>
                      </StoppingPointLabel>

                      <StoppingPointLabel as="label" align="center" gap="xs">
                        <Radio
                          {...baseProps}
                          value="code_changes"
                          checked={field.state.value === 'code_changes'}
                          onChange={() => field.handleChange('code_changes')}
                        />
                        <Text size="sm" bold={false}>
                          {t('Propose Code Changes')}
                        </Text>
                      </StoppingPointLabel>
                    </StoppingPointContainer>
                    {indicator ?? <Flex width="14px" flexShrink={0} />}
                  </Flex>
                )}
              </field.Base>

              {/* <field.Switch
                  checked={
                    organization.enableSeerCoding === false ? false : field.state.value
                  }
                  onChange={field.handleChange}
                  disabled={
                    organization.enableSeerCoding === false
                      ? t('Enable Code Generation to allow Autofix to create PRs.')
                      : !canWrite
                  }
                /> */}
            </Container>
          </field.Layout.Row>
        </Stack>
      )}
    </AutoSaveForm>
  );
}

const StoppingPointContainer = styled(Flex, {
  shouldForwardProp: prop => prop !== 'selectedValue',
})<{selectedValue: string}>`
  position: relative;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    /* Vertically centered through the radio buttons (24px default diameter → 12px center) */
    top: 12px;
    transform: translateY(-50%);
    height: 1em;

    /*
     * Left is fixed at the center of the first item.
     * Width expands to reach the center of whichever item is selected,
     * animating left to right. Each label has flex:1 so all three are equal
     * width W = (100% - 2*gap) / 3. Distance from center of item 1 to:
     *   item 2: W + gap     = (100% + gap) / 3
     *   item 3: 2W + 2*gap = (200% + 2*gap) / 3
     */
    left: calc((100% - ${p => p.theme.space.md} * 2) / 6);
    width: ${p => {
      const gap = p.theme.space.md;
      switch (p.selectedValue) {
        case 'root_cause':
          return `calc((100% + ${gap}) / 3)`;
        case 'code_changes':
        case 'open_pr':
          return `calc((200% + ${gap} * 2) / 3)`;
        default: // 'off'
          return '0px';
      }
    }};

    background: ${p => p.theme.colors.blue400};
    pointer-events: none;
    z-index: -1;
    transition: width ${p => p.theme.motion.smooth.moderate};
  }
`;

const StoppingPointLabel = styled(Stack)`
  flex: 1;
  & input {
    opacity: 1 !important;
    background: ${p => p.theme.tokens.background.primary};
  }
`;
