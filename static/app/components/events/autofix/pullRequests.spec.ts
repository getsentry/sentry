import {
  getCodingAgentResultLink,
  getRepoPullRequestLink,
} from 'sentry/components/events/autofix/pullRequests';
import type {
  ExplorerCodingAgentState,
  RepoPRState,
} from 'sentry/views/seerExplorer/types';

type CodingAgentResult = NonNullable<ExplorerCodingAgentState['results']>[number];

function makeResult(result: Partial<CodingAgentResult> = {}): CodingAgentResult {
  return {
    description: 'Fixed',
    repo_full_name: 'org/repo',
    repo_provider: 'github',
    pr_number: null,
    pr_url: null,
    ...result,
  };
}

function makeRepoPRState(state: Partial<RepoPRState> = {}): RepoPRState {
  return {
    branch_name: 'seer/fix',
    commit_sha: 'abc123',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 1,
    pr_number: 7,
    pr_url: 'https://github.com/org/repo/pull/7',
    repo_name: 'org/repo',
    title: 'Fix it',
    ...state,
  };
}

describe('getCodingAgentResultLink', () => {
  it('names the PR when the result carries a number', () => {
    expect(
      getCodingAgentResultLink(
        makeResult({pr_number: 99, pr_url: 'https://github.com/org/repo/pull/99'})
      )
    ).toEqual({
      label: 'View org/repo#99',
      repoName: 'org/repo',
      prNumber: 99,
      url: 'https://github.com/org/repo/pull/99',
    });
  });

  it.each([
    ['a pull request', 'https://github.com/org/repo/pull/99'],
    ['a pushed branch', 'https://github.com/org/repo/tree/my-branch'],
  ])('names the repo alone for %s recorded without a number', (_case, pr_url) => {
    expect(getCodingAgentResultLink(makeResult({pr_url}))).toEqual({
      label: 'View org/repo',
      repoName: 'org/repo',
      prNumber: null,
      url: pr_url,
    });
  });

  it('returns null when the agent reported no URL', () => {
    expect(getCodingAgentResultLink(makeResult())).toBeNull();
  });
});

describe('getRepoPullRequestLink', () => {
  it('names the PR Seer opened', () => {
    expect(getRepoPullRequestLink(makeRepoPRState())).toEqual({
      label: 'View org/repo#7',
      repoName: 'org/repo',
      prNumber: 7,
      url: 'https://github.com/org/repo/pull/7',
    });
  });

  it.each([
    ['creation has not finished', {pr_creation_status: 'creating' as const}],
    ['creation errored', {pr_creation_status: 'error' as const}],
    ['there is no URL', {pr_url: null}],
    ['there is no number', {pr_number: null}],
  ])('returns null when %s', (_case, state) => {
    expect(getRepoPullRequestLink(makeRepoPRState(state))).toBeNull();
  });
});
