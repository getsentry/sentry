import {useCallback, useMemo} from 'react';
import {useInfiniteQuery, useQuery} from '@tanstack/react-query';

import {
  organizationIntegrationsCodingAgents,
  type CodingAgentIntegration,
} from 'sentry/components/events/autofix/useAutofix';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  getSeerProjectReposInfiniteQueryOptions,
  isGitHubProvider,
} from 'sentry/utils/seer/seerProjectRepos';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

interface RepoEligibility {
  hasNonGithubRepo: boolean;
  hasReposConnected: boolean;
}

interface UseCodingAgentsOptions {
  autofix: Pick<ReturnType<typeof useExplorerAutofix>, 'triggerCodingAgentHandoff'>;
  group: {id: string; project: AvatarProject};
  referrer: string | undefined;
  runId: SeerExplorerRunId;
  step: 'root_cause' | 'solution' | 'code_changes';
  enabled?: boolean;
  onHandoff?: () => void;
  repoEligibility?: RepoEligibility;
}

export function useCodingAgents({
  autofix,
  group,
  runId,
  step,
  referrer,
  enabled = true,
  onHandoff,
  repoEligibility,
}: UseCodingAgentsOptions) {
  const organization = useOrganization();
  const {triggerCodingAgentHandoff} = autofix;

  const {data: codingAgentResponse, isLoading: isAgentsLoading} = useQuery({
    ...organizationIntegrationsCodingAgents(organization),
    enabled,
  });

  const reposEnabled = enabled && repoEligibility === undefined;
  const reposQuery = useInfiniteQuery({
    ...getSeerProjectReposInfiniteQueryOptions({organization, project: group.project}),
    enabled: reposEnabled,
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  useFetchAllPages({result: reposQuery, enabled: reposEnabled});
  const repos = reposQuery.data ?? [];

  // Wait until pagination is fully drained so the gate is computed over every repo.
  const isReposLoading =
    repoEligibility === undefined &&
    (reposQuery.isPending || reposQuery.isFetchingNextPage || reposQuery.hasNextPage);
  const hasNoRepos = repoEligibility
    ? !repoEligibility.hasReposConnected
    : repos.length === 0;
  const hasNonGithubRepo = repoEligibility
    ? repoEligibility.hasNonGithubRepo
    : repos.some(repo => !isGitHubProvider(repo.provider));

  const codingAgentIntegrations = useMemo(
    () => (isReposLoading ? undefined : codingAgentResponse?.integrations),
    [codingAgentResponse?.integrations, isReposLoading]
  );

  const isLoading = enabled && (isAgentsLoading || isReposLoading);

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

  return {
    codingAgentIntegrations,
    codingAgentDisabledReason,
    handleCodingAgentHandoff,
    isLoading,
  };
}
