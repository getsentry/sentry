import {t} from 'sentry/locale';
import type {
  ExplorerCodingAgentState,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

type CodingAgentResult = NonNullable<ExplorerCodingAgentState['results']>[number];

/**
 * A link to a pull request an autofix run produced, resolved from either of the two
 * shapes Seer reports one in so that every surface renders the same label.
 */
interface AutofixResultLink {
  label: string;
  url: string;
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
    url: state.pr_url,
  };
}

/**
 * What a coding agent produced, or null if it reported no URL.
 *
 * `auto_create_pr=false` pushes a branch instead of opening a PR and `pr_url` holds
 * either, so the two are told apart by URL shape.
 */
export function getCodingAgentResultLink(
  result: CodingAgentResult
): AutofixResultLink | null {
  if (!result.pr_url) {
    return null;
  }

  return {
    label: result.pr_url.includes('/tree/') ? t('View Branch') : t('View Pull Request'),
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
