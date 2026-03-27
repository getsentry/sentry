import {css} from '@emotion/react';
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
import {Text} from '@sentry/scraps/text';

import {openModal} from 'sentry/actionCreators/modal';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {bulkAutofixAutomationSettingsInfiniteOptions} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {ScmRepoTreeModal} from 'sentry/components/repositories/scmRepoTreeModal';
import {IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {fetchMutation, useQuery} from 'sentry/utils/queryClient';
import {useInfiniteQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';
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
        autofixItems,
        projectsWithRepos,
        projectsWithAutomation,
        projectsWithCreatePr,
        totalProjects: autofixItems.length ?? 0,
        projectsWithReposCount: projectsWithRepos.length ?? 0,
        projectsWithAutomationCount: projectsWithAutomation.length ?? 0,
        projectsWithCreatePrCount: projectsWithCreatePr.length ?? 0,
      };
    },
  });
  useFetchAllPages({result: autofixSettingsResult});
  return autofixSettingsResult;
}

interface Props {
  isLoading: boolean;
  stats: ReturnType<typeof useSeerOverviewData>['stats'];
}

export function AutofixOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const schema = z.object({
    placeholder: z.string(),
    defaultCodingAgent: z.string(),
    autoOpenPrs: z.boolean(),
  });

  const orgMutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data,
      }),
    onSuccess: updateOrganization,
  });

  const {data: integrations} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    select: data => data.json.integrations ?? [],
  });
  const rawAgentOptions = useAgentOptions({integrations: integrations ?? []});
  const codingAgentOptions = rawAgentOptions.map(option => ({
    value:
      option.value === 'seer' || option.value === 'none'
        ? option.value
        : option.value.id!,
    label: option.label,
  }));

  const codingAgentMutationOpts = mutationOptions({
    mutationFn: (data: {defaultCodingAgent: string}) => {
      const selected = data.defaultCodingAgent;
      return fetchMutation<Organization>({
        method: 'PUT',
        url: `/organizations/${organization.slug}/`,
        data:
          selected === 'seer'
            ? {defaultCodingAgent: selected, defaultCodingAgentIntegrationId: null}
            : selected === 'none'
              ? {defaultCodingAgent: null, defaultCodingAgentIntegrationId: null}
              : {
                  defaultCodingAgent: selected,
                  defaultCodingAgentIntegrationId: Number(selected),
                },
      });
    },
    onSuccess: updateOrganization,
  });

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
      <ConnectToReposField />

      <AutoSaveForm
        name="defaultCodingAgent"
        schema={schema}
        initialValue={
          organization.defaultCodingAgentIntegrationId
            ? String(organization.defaultCodingAgentIntegrationId)
            : organization.defaultCodingAgent
              ? organization.defaultCodingAgent
              : 'none'
        }
        mutationOptions={codingAgentMutationOpts}
      >
        {field => (
          <Stack gap="md">
            <field.Layout.Row
              label={t('Default Coding Agent')}
              hintText={t(
                'For all new projects, select which coding agent Seer will hand off to when processing issues.'
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
                busy={isLoading}
                disabled={
                  !canWrite || stats.projectsWithReposCount === stats.totalProjects
                }
                onClick={() => {
                  // TODO
                }}
              >
                {tn(
                  'Set for the existing project',
                  'Set for all existing projects',
                  stats.projectsWithReposCount
                )}
              </Button>
              <Text variant="secondary" size="sm">
                {t(
                  '%s of %s existing projects use %s',
                  stats.projectsWithAutomationCount,
                  stats.totalProjects,
                  codingAgentOptions.find(option => option.value === field.state.value)
                    ?.label
                )}
              </Text>
            </Flex>
          </Stack>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="autoOpenPrs"
        schema={schema}
        initialValue={organization.autoOpenPrs ?? false}
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <Stack gap="md">
            <field.Layout.Row
              label={t('Allow Autofix to create PRs by Default')}
              hintText={tct(
                'For all new projects with connected repos, Seer will be able to make pull requests for [docs:highly actionable] issues.',
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
                busy={isLoading}
                disabled={
                  !canWrite ||
                  organization.enableSeerCoding === false ||
                  stats.projectsWithReposCount === stats.totalProjects
                }
                onClick={() => {
                  // TODO
                }}
              >
                {field.state.value
                  ? tn(
                      'Enable for the existing project',
                      'Enable for all existing projects',
                      stats.projectsWithReposCount
                    )
                  : tn(
                      'Disable for the existing project',
                      'Disable for all existing projects',
                      stats.projectsWithReposCount
                    )}
              </Button>
              <Text variant="secondary" size="sm">
                {field.state.value
                  ? t(
                      '%s of %s existing repos have Create PR enabled',
                      stats.projectsWithCreatePrCount,
                      stats.totalProjects
                    )
                  : t(
                      '%s of %s existing repos have Create PR disabled',
                      stats.totalProjects - stats.projectsWithCreatePrCount,
                      stats.totalProjects
                    )}
              </Text>
            </Flex>

            {organization.enableSeerCoding === false && (
              <Alert variant="warning">
                {tct(
                  '[settings:"Enable Code Generation"] must be enabled for Seer to create pull requests.',
                  {
                    settings: (
                      <Link
                        to={`/settings/${organization.slug}/seer/#enableSeerCoding`}
                      />
                    ),
                  }
                )}
              </Alert>
            )}
          </Stack>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}

function ConnectToReposField() {
  const form = useScrapsForm(defaultFormOptions);

  return (
    <form.AppForm form={form}>
      <form.AppField name="placeholder">
        {field => (
          <Stack gap="md">
            <field.Layout.Row
              label={t('Projects with connected repos')}
              hintText={t(
                'Projects must be connected to a repo in order for Autofix to collect context, and debug issues.'
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
          </Stack>
        )}
      </form.AppField>
    </form.AppForm>
  );
}
