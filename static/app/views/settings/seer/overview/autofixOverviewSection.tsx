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

  // Autofix Data
  const autofixSettingsResult = useInfiniteQuery({
    ...bulkAutofixAutomationSettingsInfiniteOptions({organization}),
    select: ({pages}) => {
      const autofixItems = pages.flatMap(page => page.json).filter(s => s !== null);

      const projectsWithRepos = autofixItems.filter(settings => settings.reposCount > 0);
      const projectsWithAutomation = autofixItems.filter(
        settings => settings.autofixAutomationTuning !== 'off'
      );
      const projectsWithCreatePr = autofixItems.filter(
        settings => settings.automationHandoff?.auto_create_pr
      );

      return {
        projectsWithRepos,
        projectsWithAutomation,
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
    projectsWithAutomation = [],
    projectsWithCreatePr = [],
  } = data ?? {};

  const projectsWithReposCount = projectsWithRepos.length;
  const projectsWithAutomationCount = projectsWithAutomation.length;
  const projectsWithCreatePrCount = projectsWithCreatePr.length;

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
        projectsWithAutomationCount={projectsWithAutomationCount}
        projectsWithReposCount={projectsWithReposCount}
      />

      <CreatePrForm
        canWrite={canWrite}
        isPending={isPending}
        organization={organization}
        projects={projects}
        projectsWithCreatePrCount={projectsWithCreatePrCount}
        projectsWithReposCount={projectsWithReposCount}
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
                      : t(
                          'Your existing project does not have any repos connected',
                          projectsWithReposCount,
                          projects.length
                        )
                    : projects.length === projectsWithReposCount
                      ? t('All of your existing projects have repos connected')
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
  projectsWithAutomationCount,
  projectsWithReposCount,
}: {
  canWrite: boolean;
  isPending: boolean;
  organization: Organization;
  projects: Project[];
  projectsWithAutomationCount: number;
  projectsWithReposCount: number;
}) {
  // Coding Agent options
  const {data: integrations} = useQuery(
    organizationIntegrationsCodingAgents(organization)
  );
  const rawAgentOptions = useAgentOptions({
    integrations: integrations?.integrations ?? [],
  });
  const codingAgentOptions = rawAgentOptions.map(option => ({
    value:
      option.value === 'seer' || option.value === 'none'
        ? option.value
        : option.value.id!,
    label: option.label,
  }));

  // Default Preferred Coding Agent field
  const codingAgentMutationOpts = mutationOptions({
    mutationFn: ({agentName}: {agentName: string}) => {
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          agentName === 'seer'
            ? {defaultCodingAgent: agentName, defaultCodingAgentIntegrationId: null}
            : agentName === 'none'
              ? {defaultCodingAgent: null, defaultCodingAgentIntegrationId: null}
              : {
                  defaultCodingAgent: agentName,
                  defaultCodingAgentIntegrationId: Number(agentName),
                },
      });
    },
    onSuccess: updateOrganization,
  });

  const preferredAgentName = organization.defaultCodingAgentIntegrationId
    ? String(organization.defaultCodingAgentIntegrationId)
    : organization.defaultCodingAgent
      ? organization.defaultCodingAgent
      : 'none';

  return (
    <AutoSaveForm
      name="agentName"
      schema={z.object({agentName: z.string()})}
      initialValue={preferredAgentName}
      mutationOptions={codingAgentMutationOpts}
    >
      {field => (
        <Stack gap="md">
          <field.Layout.Row
            label={t('Default Preferred Coding Agent')}
            hintText={t(
              'For new projects, select which coding agent to use for planning and coding fixes.'
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
              disabled={!canWrite || projectsWithReposCount === projects.length}
              onClick={() => {
                // TODO
              }}
            >
              {tn(
                'Set for the existing project',
                'Set for all existing projects',
                projectsWithReposCount
              )}
            </Button>
            <Text variant="secondary" size="sm">
              {t(
                '%s of %s existing projects use %s',
                projectsWithAutomationCount,
                projects.length,
                codingAgentOptions.find(option => option.value === field.state.value)
                  ?.label
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
  projectsWithReposCount,
}: {
  canWrite: boolean;
  isPending: boolean;
  organization: Organization;
  projects: Project[];
  projectsWithCreatePrCount: number;
  projectsWithReposCount: number;
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
            hintText={tct(
              'For new projects, when Seer suggests a code change it will also create a PR for your review.',
              {
                docs: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                ),
              }
            )}
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
                projectsWithReposCount === projects.length
              }
              onClick={() => {
                // TODO
              }}
            >
              {field.state.value
                ? tn(
                    'Enable for the existing project',
                    'Enable for all existing projects',
                    projectsWithReposCount
                  )
                : tn(
                    'Disable for the existing project',
                    'Disable for all existing projects',
                    projectsWithReposCount
                  )}
            </Button>
            <Text variant="secondary" size="sm">
              {field.state.value
                ? t(
                    '%s of %s existing repos have Create PR enabled',
                    projectsWithCreatePrCount,
                    projects.length
                  )
                : t(
                    '%s of %s existing repos have Create PR disabled',
                    projects.length - projectsWithCreatePrCount,
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
  // const [mockValue, setMockValue] = useState<
  //   | 'off'
  //   | Organization['defaultAutomatedRunStoppingPoint'][keyof Organization['defaultAutomatedRunStoppingPoint']]
  // >('off');

  const stoppingPointMutationOpts = mutationOptions({
    mutationFn: ({
      stoppingPoint,
    }: {
      stoppingPoint:
        | 'off'
        | Organization['defaultAutomatedRunStoppingPoint'][keyof Organization['defaultAutomatedRunStoppingPoint']];
    }) => {
      // setMockValue(stoppingPoint);
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

  // const initialValue = mockValue;
  const initialValue =
    organization.defaultAutofixAutomationTuning === 'off'
      ? 'off'
      : (organization.defaultAutomatedRunStoppingPoint ?? 'off');

  console.log({initialValue});

  return (
    <AutoSaveForm
      name="stoppingPoint"
      schema={z.object({
        // stoppingPoint: z.string(),
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
                docs: (
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

                {false && (
                  <field.Radio.Group
                    value={field.state.value}
                    onChange={field.handleChange}
                  >
                    <field.Layout.Stack label={t('Priority')}>
                      <field.Radio.Item value={'off' as const}>
                        {t('No Automation')}
                      </field.Radio.Item>
                      <field.Radio.Item value={'root_cause' as const}>
                        {t('Automate Root Cause Analysis')}
                      </field.Radio.Item>
                      {organization.autoOpenPrs ? (
                        <field.Radio.Item value={'open_pr' as const}>
                          {t('Automate Code Changes and Create PR')}
                        </field.Radio.Item>
                      ) : (
                        <field.Radio.Item value={'code_changes' as const}>
                          {t('Automate Code Changes')}
                        </field.Radio.Item>
                      )}
                    </field.Layout.Stack>
                  </field.Radio.Group>
                )} */}

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
                          checked
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
                          checked={['off', 'root_cause'].includes(field.state.value)}
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
                          {t('Code Changes')}
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
    /*
     * Left is fixed at the center of the first item.
     * Width expands to reach the center of whichever item is selected,
     * animating left to right. Each label has flex:1 so all three are equal
     * width W = (100% - 2×gap) / 3. Distance from center of item 1 to:
     *   item 2: W + gap     = (100% + gap) / 3
     *   item 3: 2W + 2×gap = (200% + 2×gap) / 3
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
    height: 1em;
    transform: translateY(-50%);
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
