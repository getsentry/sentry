import {useCallback, useMemo} from 'react';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';

import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  getSeerProjectReposInfiniteQueryOptions,
  isGitHubProvider,
} from 'sentry/utils/seer/seerProjectRepos';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

interface UseCodingAgentsOptions {
  autofix: ReturnType<typeof useExplorerAutofix>;
  group: Group;
  referrer: string | undefined;
  runId: SeerExplorerRunId;
  step: 'root_cause' | 'solution';
  enabled?: boolean;
  onHandoff?: () => void;
}

export function useCodingAgents({
  autofix,
  group,
  runId,
  step,
  referrer,
  enabled = true,
  onHandoff,
}: UseCodingAgentsOptions) {
  const organization = useOrganization();
  const {triggerCodingAgentHandoff} = autofix;

  const {data: codingAgentResponse} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    enabled,
  });

  const reposQuery = useInfiniteQuery({
    ...getSeerProjectReposInfiniteQueryOptions({organization, project: group.project}),
    enabled,
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  useFetchAllPages({result: reposQuery, enabled});
  const repos = reposQuery.data ?? [];

  // Wait until pagination is fully drained so the gate is computed over every repo.
  const isReposLoading =
    reposQuery.isPending || reposQuery.isFetchingNextPage || reposQuery.hasNextPage;
  const hasNoRepos = repos.length === 0;
  const hasNonGithubRepo = repos.some(repo => !isGitHubProvider(repo.provider));

  const codingAgentIntegrations = useMemo(
    () => (isReposLoading ? undefined : codingAgentResponse?.integrations),
    [codingAgentResponse?.integrations, isReposLoading]
  );

  const codingAgentDisabledReason = hasNoRepos
    ? t('Connect a GitHub repository to hand off to a coding agent.')
    : hasNonGithubRepo
      ? t('Handing off to a coding agent requires a connected GitHub repository.')
      : undefined;

  const handleCodingAgentHandoff = useCallback(
    (integration: CodingAgentIntegration) => {
      if (integration.requires_identity && !integration.has_identity) {
        const currentUrl = window.location.href;
        window.location.href = `/remote/github-copilot/oauth/?next=${encodeURIComponent(currentUrl)}`;
        return;
      }

      onHandoff?.();
      triggerCodingAgentHandoff(runId, integration);
      trackAnalytics('autofix.coding_agent.launch', {
        organization,
        group_id: group.id,
        step,
        provider: integration.provider,
        mode: 'explorer',
        referrer,
      });
    },
    [triggerCodingAgentHandoff, organization, runId, group, step, referrer, onHandoff]
  );

  return {codingAgentIntegrations, codingAgentDisabledReason, handleCodingAgentHandoff};
}
