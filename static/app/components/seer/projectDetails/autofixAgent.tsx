import {useInfiniteQuery, useQuery, useQueryClient} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  isGithubRepoProvider,
  NON_GITHUB_HANDOFF_WARNING,
  seerAgentIntegrationsSelectQueryOptions,
  knownAgentIntegrationsQueryOptions,
  coalesePreferredAgent,
} from 'sentry/utils/seer/preferredAgent';
import {getSeerProjectReposInfiniteQueryOptions} from 'sentry/utils/seer/seerProjectRepos';
import {
  getMutateSeerProjectSettingsOptions,
  getSeerProjectSettingsQueryOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {
  coaleseStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  canWrite: boolean;

  project: DetailedProject;
}

export function AutofixAgent({canWrite, project}: Props) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  const {data: agentSelectOptions = []} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );
  const stoppingPointOptions = useStoppingPointSelectOptions();

  // Only GitHub repos can hand off to an external coding agent, so the agent
  // dropdown is disabled when this project has any non-GitHub repo attached.
  const reposResult = useInfiniteQuery(
    getSeerProjectReposInfiniteQueryOptions({organization, project: {slug: project.slug}})
  );
  useFetchAllPages({result: reposResult});
  const isOnlyGithubRepos = (reposResult.data?.pages ?? [])
    .flatMap(page => page.json)
    .every(repo => isGithubRepoProvider(repo.provider));

  const {data, isPending, isError, error} = useQuery(
    getSeerProjectSettingsQueryOptions({
      organization,
      project: {slug: project.slug},
    })
  );

  if (isPending) {
    return (
      <Flex justify="center" padding="xl">
        <LoadingIndicator />
      </Flex>
    );
  }

  if (isError) {
    return (
      <Flex justify="center" padding="xl">
        <Text variant="muted">{t('Error: %s', error.message)}</Text>
      </Flex>
    );
  }

  if (!data) {
    return (
      <Flex justify="center" padding="xl">
        <Text variant="muted">{t('No data found')}</Text>
      </Flex>
    );
  }

  return (
    <FieldGroup>
      <AutoSaveForm
        name="agentOption"
        schema={seerProjectSettingsSchema}
        initialValue={coalesePreferredAgent(data.agent, data.integrationId)}
        mutationOptions={getMutateSeerProjectSettingsOptions({
          organization,
          project: {slug: project.slug},
          queryClient,
          knownAgents,
        })}
      >
        {field => (
          <Stack gap="md">
            {!isOnlyGithubRepos && (
              <Alert variant="warning">{NON_GITHUB_HANDOFF_WARNING}</Alert>
            )}
            <field.Layout.Row
              label={t('Handoff to Agent')}
              hintText={tct(
                'Select your preferred agent to create a plan, and code up an issue fix. Seer Agent will always be used for the Root Cause Analysis step. [manageLink:Manage Coding Agents].',
                {
                  manageLink: (
                    <Link
                      to={{
                        pathname: `/settings/${organization.slug}/integrations/`,
                        query: {category: 'coding agent'},
                      }}
                    />
                  ),
                }
              )}
            >
              <field.Select
                disabled={!canWrite || !isOnlyGithubRepos}
                multiple={false}
                onChange={field.handleChange}
                options={agentSelectOptions}
                value={isOnlyGithubRepos ? field.state.value : 'seer'}
              />
            </field.Layout.Row>
          </Stack>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="stoppingPoint"
        schema={seerProjectSettingsSchema}
        initialValue={coaleseStoppingPoint(data.stoppingPoint, data.automationTuning)}
        mutationOptions={getMutateSeerProjectSettingsOptions({
          organization,
          project: {slug: project.slug},
          queryClient,
        })}
      >
        {field => (
          <field.Layout.Row
            label={t('Automation Steps')}
            hintText={tct(
              'Choose which steps Seer should run automatically on issues. Depending on how [actionable:actionable] the issue is, Seer may stop at an earlier step.',
              {
                actionable: (
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works" />
                ),
              }
            )}
          >
            <field.Select
              disabled={!canWrite}
              value={field.state.value}
              onChange={field.handleChange}
              options={stoppingPointOptions}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
