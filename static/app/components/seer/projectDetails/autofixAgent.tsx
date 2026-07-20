import {useEffect} from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

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
  NON_GITHUB_HANDOFF_WARNING,
  seerAgentIntegrationsSelectQueryOptions,
  knownAgentIntegrationsQueryOptions,
  coalesePreferredAgent,
} from 'sentry/utils/seer/preferredAgent';
import {
  getSeerProjectReposInfiniteQueryOptions,
  isGitHubProvider,
} from 'sentry/utils/seer/seerProjectRepos';
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

  const {data: agentSelectOptions = [], isPending: isAgentOptionsPending} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );
  const stoppingPointOptions = useStoppingPointSelectOptions();

  // Only GitHub repos can hand off to an external coding agent, so the agent
  // dropdown is disabled when this project has any non-GitHub repo attached.
  const reposResult = useInfiniteQuery(
    getSeerProjectReposInfiniteQueryOptions({organization, project: {slug: project.slug}})
  );
  useFetchAllPages({result: reposResult});
  // An empty or partially-loaded page list would make `.every(isGithub)` true,
  // so gate on the query being fully settled: until every page is in we can't
  // know the project is GitHub-only, and must not enable the dropdown or hide
  // the warning (a repos-fetch error keeps handoff restricted, which is safe).
  const reposLoaded =
    reposResult.isSuccess && !reposResult.hasNextPage && !reposResult.isFetchingNextPage;
  const hasNonGithubRepo = (reposResult.data?.pages ?? [])
    .flatMap(page => page.json)
    .some(repo => !isGitHubProvider(repo.provider));
  const restrictToSeer = reposLoaded && hasNonGithubRepo;

  // `isIdle` is true only until the first attempt settles, so the effect below
  // fires at most once. This matters because the mutation rolls back its
  // optimistic update on error; without a one-shot guard a failed persist would
  // restore the coding agent, re-satisfy the condition, and loop indefinitely.
  const {mutate: persistAgentOption, isIdle: agentPersistNotAttempted} = useMutation(
    getMutateSeerProjectSettingsOptions({
      organization,
      project: {slug: project.slug},
      queryClient,
      knownAgents,
    })
  );

  const {data, isPending, isError, error} = useQuery(
    getSeerProjectSettingsQueryOptions({
      organization,
      project: {slug: project.slug},
    })
  );

  // A non-GitHub repo means the stored agent can no longer hand off, so persist
  // Seer (rather than only overriding the dropdown's display value) to keep the
  // saved setting consistent with what the user sees. The optimistic update in
  // the mutation flips `storedAgent` to 'seer', so this fires at most once.
  const storedAgent = data
    ? coalesePreferredAgent(data.agent, data.integrationId)
    : undefined;
  useEffect(() => {
    if (
      canWrite &&
      restrictToSeer &&
      storedAgent !== undefined &&
      storedAgent !== 'seer' &&
      agentPersistNotAttempted
    ) {
      persistAgentOption({agentOption: 'seer'});
    }
  }, [
    canWrite,
    restrictToSeer,
    storedAgent,
    agentPersistNotAttempted,
    persistAgentOption,
  ]);

  // The "Handoff to Agent" select's value comes from the settings query, but its
  // options come from `agentSelectOptions`. Rendering before the options load
  // leaves the select with a value that matches nothing, so it briefly shows its
  // placeholder before the option pops in. Wait for both queries to settle.
  if (isPending || isAgentOptionsPending) {
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
            {restrictToSeer && <Alert variant="info">{NON_GITHUB_HANDOFF_WARNING}</Alert>}
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
                disabled={!canWrite || !reposLoaded || hasNonGithubRepo}
                multiple={false}
                onChange={field.handleChange}
                options={agentSelectOptions}
                value={restrictToSeer ? 'seer' : field.state.value}
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
