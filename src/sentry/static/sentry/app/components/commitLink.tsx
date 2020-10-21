import * as React from 'react';

import {Repository} from 'app/types';
import {t} from 'app/locale';
import {getShortCommitHash} from 'app/utils';
import Button from 'app/components/button';
import {IconBitbucket, IconGithub, IconGitlab, IconVsts} from 'app/icons';
import ExternalLink from 'app/components/links/externalLink';

type CommitFormatterParameters = {
  baseUrl: string;
  commitId: string;
};

type CommitProvider = {
  icon: React.ReactNode;
  providerIds: string[];
  commitUrl: (CommitFormatterParameters) => string;
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
  commitId: string;
  repository?: Repository;
  inline?: boolean;
};

function CommitLink({inline, commitId, repository}: Props) {
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
    <Button external href={commitUrl} size="small" icon={providerData.icon}>
      {shortId}
    </Button>
  ) : (
    <ExternalLink className="inline-commit" href={commitUrl}>
      {providerData.icon}
      {' ' + shortId}
    </ExternalLink>
  );
}

export default CommitLink;
