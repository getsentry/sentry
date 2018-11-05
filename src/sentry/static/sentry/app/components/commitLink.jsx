import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import {getShortVersion} from 'app/utils';
import Button from 'app/components/button';
import ExternalLink from 'app/components/externalLink';
import InlineSvg from 'app/components/inlineSvg';

// TODO(epurkhiser, jess): This should be moved into plugins.
const SUPPORTED_PROVIDERS = [
  {
    icon: 'icon-github',
    providerIds: ['github', 'integrations:github', 'integrations:github_enterprise'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
  {
    icon: 'icon-bitbucket',
    providerIds: ['bitbucket', 'integrations:bitbucket'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commits/${commitId}`,
  },
  {
    icon: 'icon-vsts',
    providerIds: ['visualstudio', 'integrations:vsts'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
  {
    icon: 'icon-gitlab',
    providerIds: ['gitlab', 'integrations:gitlab'],
    commitUrl: ({baseUrl, commitId}) => `${baseUrl}/commit/${commitId}`,
  },
];

function CommitLink({inline, commitId, repository}) {
  if (!commitId || !repository) {
    return <span>{t('Unknown Commit')}</span>;
  }

  const shortId = getShortVersion(commitId);

  const providerData = SUPPORTED_PROVIDERS.find(provider =>
    provider.providerIds.includes(repository.provider.id)
  );

  if (providerData === undefined) {
    return <span>{shortId}</span>;
  }

  const commitUrl = providerData.commitUrl({
    commitId,
    baseUrl: repository.url,
  });

  return !inline ? (
    <Button external href={commitUrl} size="small" icon={providerData.icon}>
      {shortId}
    </Button>
  ) : (
    <ExternalLink className="inline-commit" href={commitUrl}>
      <CommitIcon src={providerData.icon} />
      {' ' + shortId}
    </ExternalLink>
  );
}

CommitLink.propTypes = {
  commitId: PropTypes.string,
  repository: PropTypes.object,
  inline: PropTypes.bool,
};

const CommitIcon = styled(p => (
  <InlineSvg size="14px" src={p.src} className={p.className} />
))`
  vertical-align: text-top;
  margin-top: 2px;
`;

export default CommitLink;
