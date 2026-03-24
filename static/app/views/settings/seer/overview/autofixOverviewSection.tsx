import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {organizationIntegrationsCodingAgents} from 'sentry/components/events/autofix/useAutofix';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSettings} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {fetchMutation, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SeerOverview} from 'sentry/views/settings/seer/overview/components';
import {useSeerOverviewData} from 'sentry/views/settings/seer/overview/useSeerOverviewData';
import {useAgentOptions} from 'sentry/views/settings/seer/seerAgentHooks';

interface Props {
  isLoading: boolean;
  stats: ReturnType<typeof useSeerOverviewData>['stats'];
}

export function AutofixOverviewSection({stats, isLoading}: Props) {
  const organization = useOrganization();
  const canWrite = hasEveryAccess(['org:write'], {organization});

  const schema = z.object({
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
          {/* <QuestionTooltip
            isHoverable
            title={tct(
              'These settings apply as new projects are created. Any [link:existing projects] will not be affected.',
              {
                link: <Link to={`/settings/${organization.slug}/seer/projects/`} />,
              }
            )}
            size="xs"
            icon="info"
          /> */}
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
          <field.Layout.Row
            label={t('Default Coding Agent')}
            hintText={t(
              'For all new projects, select which coding agent Seer will hand off to when processing issues.'
            )}
          >
            <Grid columns="1fr 1fr" gap="lg">
              <Container flexGrow={1}>
                <field.Select
                  value={field.state.value}
                  onChange={field.handleChange}
                  disabled={!canWrite}
                  options={codingAgentOptions}
                />
              </Container>
              <Stack align="end" justify="center" gap="md">
                <Text variant="secondary" size="sm">
                  {t(
                    '%s of %s existing projects use %s',
                    stats.projectsWithAutomationCount,
                    stats.totalProjects,
                    codingAgentOptions.find(option => option.value === field.state.value)
                      ?.label
                  )}
                </Text>
                <Button
                  size="xs"
                  busy={isLoading}
                  disabled={stats.projectsWithReposCount === stats.totalProjects}
                  onClick={() => {
                    // TODO
                  }}
                >
                  {tn(
                    'Set for the existing project',
                    'Set for %s existing projects',
                    stats.projectsWithReposCount
                  )}
                </Button>
              </Stack>
            </Grid>
          </field.Layout.Row>
        )}
      </AutoSaveForm>
      <AutoSaveForm
        name="autoOpenPrs"
        schema={schema}
        initialValue={organization.autoOpenPrs ?? false}
        mutationOptions={orgMutationOpts}
      >
        {field => (
          <field.Layout.Row
            label={t('Allow Autofix to create PRs by Default')}
            hintText={
              <Stack gap="sm">
                <span>
                  {tct(
                    'For all new projects with connected repos, Seer will be able to make pull requests for [docs:highly actionable] issues.',
                    {
                      docs: (
                        <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                      ),
                    }
                  )}
                </span>
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
            }
          >
            <Grid columns="1fr 1fr" gap="lg">
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
              <Stack align="end" justify="center" gap="md">
                <Text variant="secondary" size="sm">
                  {field.state.value
                    ? t(
                        '%s of %s existing repos have Create PR disabled',
                        stats.totalProjects - stats.projectsWithCreatePrCount,
                        stats.totalProjects
                      )
                    : t(
                        '%s of %s existing repos have Create PR enabled',
                        stats.projectsWithCreatePrCount,
                        stats.totalProjects
                      )}
                </Text>
                <Button
                  size="xs"
                  busy={isLoading}
                  disabled={stats.projectsWithReposCount === stats.totalProjects}
                  onClick={() => {
                    // TODO
                  }}
                >
                  {field.state.value
                    ? tn(
                        'Enable for the existing project',
                        'Enable for %s existing projects',
                        stats.projectsWithReposCount
                      )
                    : tn(
                        'Disable for the existing project',
                        'Disable for %s existing projects',
                        stats.projectsWithReposCount
                      )}
                </Button>
              </Stack>
            </Grid>
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
