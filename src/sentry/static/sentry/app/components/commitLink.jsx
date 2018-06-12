import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';

const isBitbucket = providerId =>
  ['bitbucket', 'integrations:bitbucket'].includes(providerId);
const isGithub = providerId =>
  ['github', 'integrations:github', 'integrations:github_enterprise'].includes(
    providerId
  );

class CommitLink extends React.Component {
  static propTypes = {
    commitId: PropTypes.string,
    repository: PropTypes.object,
    inline: PropTypes.bool,
  };

  getCommitUrl = () => {
    // TODO(jess): move this to plugins
    if (isGithub(this.props.repository.provider.id)) {
      return this.props.repository.url + '/commit/' + this.props.commitId;
    }
    if (isBitbucket(this.props.repository.provider.id)) {
      return this.props.repository.url + '/commits/' + this.props.commitId;
    }
    return undefined;
  };

  render() {
    let {inline, commitId, repository} = this.props;

    if (!commitId || !repository) {
      return <span>{t('Unknown Commit')}</span>;
    }

    let commitUrl = this.getCommitUrl();
    let shortId = commitId.slice(0, 7);

    return commitUrl ? (
      <a
        className={inline ? 'inline-commit' : 'btn btn-default btn-sm'}
        href={commitUrl}
        target="_blank"
      >
        {isGithub(repository.provider.id) && (
          <InlineSvg src="icon-github" style={{verticalAlign: 'text-top'}} size="14px" />
        )}
        {isBitbucket(repository.provider.id) && (
          <InlineSvg
            src="icon-bitbucket"
            style={{verticalAlign: 'text-top'}}
            size="14px"
          />
        )}
        &nbsp;
        {inline ? '' : ' '}
        {shortId}
      </a>
    ) : (
      <span>{shortId}</span>
    );
  }
}

export default CommitLink;
