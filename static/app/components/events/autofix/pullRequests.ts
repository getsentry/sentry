import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import type {
  ExplorerCodingAgentState,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

type CodingAgentResult = NonNullable<ExplorerCodingAgentState['results']>[number];

/**
 * A link to a pull request an autofix run produced, resolved from either of the two
 * shapes Seer reports one in so that every surface renders the same label.
 *
 * `label` is the button wording; surfaces that word the link themselves take
 * `repoName` and `prNumber` instead.
 */
interface AutofixResultLink {
  label: string;
  prNumber: number | null;
  repoName: string;
  url: string;
}

/**
 * Whether this repo actually got a pull request onto GitHub.
 *
 * `repo_pr_states` also holds failed creates (error, no `pr_number`). Those
 * are not PRs — treating them as such swaps "retry code changes" for the
 * iteration form and 400s the submit. Matches
 * `SeerRunState.get_created_pull_request_states`.
 */
export function isCreatedPullRequestState(state: RepoPRState): boolean {
  return state.pr_creation_status !== 'error' || state.pr_number !== null;
}

export function hasCreatedPullRequests(
  repoPrStates: Record<string, RepoPRState> | null | undefined
): boolean {
  return Object.values(repoPrStates ?? {}).some(isCreatedPullRequestState);
}

/** The PR Seer opened for this repo, or null if there isn't a finished one. */
export function getRepoPullRequestLink(state: RepoPRState): AutofixResultLink | null {
  if (
    state.pr_creation_status !== 'completed' ||
    !state.pr_url ||
    !state.pr_number ||
    !state.repo_name
  ) {
    return null;
  }

  return {
    label: t('View %s#%s', state.repo_name, state.pr_number),
    repoName: state.repo_name,
    prNumber: state.pr_number,
    url: state.pr_url,
  };
}

/**
 * What a coding agent produced, or null if it reported no URL.
 *
 * `pr_url` holds a pushed branch rather than a PR when the agent ran with
 * `auto_create_pr=false`, and results predating `pr_number` carry no number either way.
 */
export function getCodingAgentResultLink(
  result: CodingAgentResult
): AutofixResultLink | null {
  if (!result.pr_url) {
    return null;
  }

  return {
    label: defined(result.pr_number)
      ? t('View %s#%s', result.repo_full_name, result.pr_number)
      : t('View %s', result.repo_full_name),
    repoName: result.repo_full_name,
    prNumber: result.pr_number,
    url: result.pr_url,
  };
}

/** The first result any of these agents reported a URL for. */
export function findCodingAgentResultLink(
  codingAgents: ExplorerCodingAgentState[]
): AutofixResultLink | null {
  for (const result of codingAgents.flatMap(codingAgent => codingAgent.results ?? [])) {
    const link = getCodingAgentResultLink(result);
    if (link) {
      return link;
    }
  }

  return null;
}
