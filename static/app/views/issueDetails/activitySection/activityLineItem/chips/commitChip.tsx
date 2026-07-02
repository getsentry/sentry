import {ExternalLink} from '@sentry/scraps/link';

import {IconCommit} from 'sentry/icons';
import type {Commit} from 'sentry/types/integrations';
import {getShortCommitHash} from 'sentry/utils/git/getShortCommitHash';

import {InlineChip} from './inlineChip';

const COMMIT_URL_PATH_BY_PROVIDER = [
  {providers: ['bitbucket', 'integrations:bitbucket'], path: 'commits'},
  {
    providers: [
      'github',
      'github_enterprise',
      'integrations:github',
      'integrations:github_enterprise',
      'gitlab',
      'integrations:gitlab',
      'visualstudio',
      'integrations:vsts',
    ],
    path: 'commit',
  },
];

function getCommitUrl(commit: Commit) {
  const repository = commit.repository;
  const provider = repository?.provider;

  if (!repository?.url || !provider) {
    return null;
  }

  const normalizedProvider = `${provider.id} ${provider.name ?? ''}`.toLowerCase();
  const urlConfig = COMMIT_URL_PATH_BY_PROVIDER.find(({providers}) =>
    providers.some(providerId => normalizedProvider.includes(providerId))
  );

  if (!urlConfig) {
    return null;
  }

  return `${repository.url}/${urlConfig.path}/${commit.id}`;
}

function formatCommitId(id: string) {
  return getShortCommitHash(id);
}

export function CommitChip({commit}: {commit: Commit}) {
  const content = (
    <InlineChip>
      <IconCommit size="xs" />
      {formatCommitId(commit.id)}
    </InlineChip>
  );
  const commitUrl = getCommitUrl(commit);

  if (!commitUrl) {
    return content;
  }

  return <ExternalLink href={commitUrl}>{content}</ExternalLink>;
}
