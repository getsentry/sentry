import styled from '@emotion/styled';

import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import {IconBitbucket, IconGithub, IconGitlab} from 'app/icons';
import {IconGitPullRequestClosed} from 'app/icons/IconGitPullRequestClosed';
import {IconGitPullRequestMerged} from 'app/icons/IconGitPullRequestMerged';
import {IconGitPullRequestOpen} from 'app/icons/iconGitPullRequestOpen';
import space from 'app/styles/space';
import {PullRequest, PullRequestAction, Repository} from 'app/types';

function renderProviderIcon(repo: Repository) {
  if (!repo.provider) {
    return null;
  }

  const {id} = repo.provider;
  const providerId = id.includes(':') ? id.split(':').pop() : id;

  switch (providerId) {
    case 'github':
      return <IconGithub size="xs" />;
    case 'gitlab':
      return <IconGitlab size="xs" />;
    case 'bitbucket':
      return <IconBitbucket size="xs" />;
    default:
      return null;
  }
}

function renderActionIcon(action: PullRequestAction) {
  switch (action) {
    case PullRequestAction.OPENED:
      return <IconGitPullRequestOpen color="green300" size="sm" />;
    case PullRequestAction.MERGED:
      return <IconGitPullRequestMerged color="purple300" size="sm" />;
    case PullRequestAction.CLOSED:
      return <IconGitPullRequestClosed color="red300" size="sm" />;
    default:
      return null;
  }
}

type Props = {
  pullRequest: PullRequest;
  repository: Repository;
  inline?: boolean;
  action?: PullRequestAction;
};

const PullRequestLink = ({pullRequest, repository, inline, action}: Props) => {
  const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title}`;

  if (!pullRequest.externalUrl) {
    return <span>{displayId}</span>;
  }

  return inline ? (
    <StyledExternalLink href={pullRequest.externalUrl}>
      {action ? renderActionIcon(action) : renderProviderIcon(repository)}
      {displayId}
    </StyledExternalLink>
  ) : (
    <Button external href={pullRequest.externalUrl} size="xsmall">
      {action ? renderActionIcon(action) : renderProviderIcon(repository)}
      {displayId}
    </Button>
  );
};

const StyledExternalLink = styled(ExternalLink)`
  display: inline-grid;
  align-items: center;
  grid-auto-flow: column;
  grid-gap: ${space(0.5)};
  color: ${p => p.theme.textColor};

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default PullRequestLink;
