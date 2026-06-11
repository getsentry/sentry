import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IconBitbucket, IconGithub, IconGitlab} from 'sentry/icons';
import type {PullRequest, Repository} from 'sentry/types/integrations';

function renderIcon(repo: Repository) {
  if (!repo.provider) {
    return null;
  }

  const {id} = repo.provider;
  const providerId = id.includes(':') ? id.split(':').pop() : id;

  switch (providerId) {
    case 'github':
      return <IconGithub size="xs" data-test-id="pull-request-github" />;
    case 'gitlab':
      return <IconGitlab size="xs" data-test-id="pull-request-gitlab" />;
    case 'bitbucket':
      return <IconBitbucket size="xs" />;
    default:
      return null;
  }
}

type Props = {
  pullRequest: PullRequest;
  repository: Repository;
};

export function PullRequestLink({pullRequest, repository}: Props) {
  const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title ?? ''}`;

  if (!pullRequest.externalUrl) {
    return (
      <Text as="span" wordBreak="break-word">
        {displayId}
      </Text>
    );
  }

  const icon = renderIcon(repository);

  return (
    <ExternalPullLink href={pullRequest.externalUrl}>
      {icon && <PullRequestProviderIcon>{icon}</PullRequestProviderIcon>}
      <Text as="span" density="comfortable" variant="inherit" wordBreak="break-word">
        {displayId}
      </Text>
    </ExternalPullLink>
  );
}

const ExternalPullLink = styled(ExternalLink)`
  display: inline;
`;

const PullRequestProviderIcon = styled('span')`
  svg {
    display: inline-block;
    margin-right: ${p => p.theme.space.xs};
    vertical-align: -0.075em;
  }
`;
