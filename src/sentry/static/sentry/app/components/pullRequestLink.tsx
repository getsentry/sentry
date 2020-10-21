import ExternalLink from 'app/components/links/externalLink';
import {IconBitbucket, IconGithub, IconGitlab} from 'app/icons';
import {Repository, PullRequest} from 'app/types';

function renderIcon(repo: Repository) {
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

type Props = {
  pullRequest: PullRequest;
  repository: Repository;
  inline?: boolean;
};

const PullRequestLink = ({pullRequest, repository, inline}: Props) => {
  const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title}`;

  return pullRequest.externalUrl ? (
    <ExternalLink
      className={inline ? 'inline-commit' : 'btn btn-default btn-sm'}
      href={pullRequest.externalUrl}
    >
      {renderIcon(repository)}
      {inline ? '' : ' '}
      {displayId}
    </ExternalLink>
  ) : (
    <span>{displayId}</span>
  );
};

export default PullRequestLink;
