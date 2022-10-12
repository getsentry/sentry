import Button from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconBitbucket, IconGithub, IconGitlab, IconVsts} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Repository} from 'sentry/types';
import {getShortCommitHash} from 'sentry/utils';

type CommitFormatterParameters = {
  baseUrl: string;
  commitId: string;
};

type CommitProvider = {
  commitUrl: (opts: CommitFormatterParameters) => string;
  icon: React.ReactNode;
  providerIds: string[];
};

// TODO(epurkhiser, jess): This should be moved into plugins.
const SUPPORTED_PROVIDERS: Readonly<CommitProvider[]> = [
  {
    icon: <IconGithub size="xs" />,
    providerIds: ['github', 'integrations:github', 'integrations:github_enterprise'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
  {
    icon: <IconBitbucket size="xs" />,
    providerIds: ['bitbucket', 'integrations:bitbucket'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commits/${commitId}`,
  },
  {
    icon: <IconVsts size="xs" />,
    providerIds: ['visualstudio', 'integrations:vsts'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
  {
    icon: <IconGitlab size="xs" />,
    providerIds: ['gitlab', 'integrations:gitlab'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
];

type Props = {
  commitId?: string;
  inline?: boolean;
  onClick?: () => void;
  repository?: Repository;
  showIcon?: boolean;
};

function CommitLink({inline, commitId, repository, showIcon = true, onClick}: Props) {
  if (!commitId || !repository) {
    return <span>{t('Unknown Commit')}</span>;
  }

  const shortId = getShortCommitHash(commitId);

  const providerData = SUPPORTED_PROVIDERS.find(provider => {
    if (!repository.provider) {
      return false;
    }
    return provider.providerIds.includes(repository.provider.id);
  });

  if (providerData === undefined) {
    return <span>{shortId}</span>;
  }

  const commitUrl =
    repository.url &&
    providerData.commitUrl({
      commitId,
      baseUrl: repository.url,
    });

  return !inline ? (
    <Button
      external
      href={commitUrl}
      size="sm"
      icon={showIcon ? providerData.icon : null}
      onClick={onClick}
    >
      {shortId}
    </Button>
  ) : (
    <ExternalLink href={commitUrl} onClick={onClick}>
      {showIcon ? providerData.icon : null}
      {' ' + shortId}
    </ExternalLink>
  );
}

export default CommitLink;
