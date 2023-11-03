import {LinkButton} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconBitbucket, IconGithub, IconGitlab, IconVsts} from 'sentry/icons';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {Repository} from 'sentry/types';
import {getShortCommitHash} from 'sentry/utils';

type CommitFormatterParameters = {
  baseUrl: string;
  commitId: string;
};

type CommitProvider = {
  commitUrl: (opts: CommitFormatterParameters) => string;
  icon: React.ComponentType<SVGIconProps>;
  providerIds: string[];
};

// TODO(epurkhiser, jess): This should be moved into plugins.
const SUPPORTED_PROVIDERS: Readonly<CommitProvider[]> = [
  {
    icon: IconGithub,
    providerIds: ['github', 'integrations:github', 'integrations:github_enterprise'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
  {
    icon: IconBitbucket,
    providerIds: ['bitbucket', 'integrations:bitbucket'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commits/${commitId}`,
  },
  {
    icon: IconVsts,
    providerIds: ['visualstudio', 'integrations:vsts'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
  {
    icon: IconGitlab,
    providerIds: ['gitlab', 'integrations:gitlab'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
];

type Props = {
  commitId?: string;
  commitTitle?: string;
  inline?: boolean;
  onClick?: () => void;
  repository?: Repository;
  showIcon?: boolean;
};

function CommitLink({
  inline,
  commitId,
  repository,
  showIcon = true,
  onClick,
  commitTitle,
}: Props) {
  if (!commitId || !repository) {
    return <span>{t('Unknown Commit')}</span>;
  }

  let label: string;
  if (commitTitle) {
    label = commitTitle;
  } else {
    label = getShortCommitHash(commitId);
  }

  const providerData = SUPPORTED_PROVIDERS.find(provider => {
    if (!repository.provider) {
      return false;
    }
    return provider.providerIds.includes(repository.provider.id);
  });

  if (providerData === undefined) {
    return <span>{label}</span>;
  }

  const commitUrl =
    repository.url &&
    providerData.commitUrl({
      commitId,
      baseUrl: repository.url,
    });

  const Icon = providerData.icon;

  return !inline ? (
    <LinkButton
      external
      href={commitUrl}
      size="sm"
      icon={showIcon ? <Icon size="sm" /> : null}
      onClick={onClick}
    >
      {label}
    </LinkButton>
  ) : (
    <ExternalLink href={commitUrl} onClick={onClick}>
      {showIcon ? <Icon size="xs" /> : null}
      {' ' + label}
    </ExternalLink>
  );
}

export default CommitLink;
