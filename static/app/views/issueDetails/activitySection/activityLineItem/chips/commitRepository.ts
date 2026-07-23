import type {Commit, Repository} from 'sentry/types/integrations';

export function getCommitRepository(commit: Commit): Repository | undefined {
  if (commit.repository?.url && commit.repository.provider?.id !== 'unknown') {
    return commit.repository;
  }

  return commit.pullRequest?.repository ?? commit.repository;
}
