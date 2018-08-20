import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import Button from 'app/components/buttons/button';
import InlineSvg from 'app/components/inlineSvg';

// TODO(epurkhiser, jess): This should be moved into plugins.
const SUPPORTED_PROVIDERS = [
  {
    icon: 'icon-github',
    providerIds: ['github', 'integrations:github', 'integrations:github_enterprise'],
    commitUrl: v => `${v.baseUrl}/commit/${v.commitId}`,
  },
  {
    icon: 'icon-bitbucket',
    providerIds: ['bitbucket', 'integrations:bitbucket'],
    commitUrl: v => `${v.baseUrl}/commits/${v.commitId}`,
  },
  {
    icon: 'icon-vsts',
    providerIds: ['visualstudio', 'integrations:vsts'],
    commitUrl: v => `${v.baseUrl}/commit/${v.commitId}`,
  },
];

function CommitLink({inline, commitId, repository}) {
  if (!commitId || !repository) {
    return <span>{t('Unknown Commit')}</span>;
  }

  const shortId = commitId.slice(0, 7);

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
    <a className="inline-commit" href={commitUrl} target="_blank">
      <InlineSvg
        src={providerData.icon}
        style={{verticalAlign: 'text-top', marginTop: '2px'}}
        size="14px"
      />
      {' ' + shortId}
    </a>
  );
}

CommitLink.propTypes = {
  commitId: PropTypes.string,
  repository: PropTypes.object,
  inline: PropTypes.bool,
};

export default CommitLink;
