import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import InlineSvg from 'app/components/inlineSvg';

class CommitLink extends React.Component {
  static propTypes = {
    commitId: PropTypes.string,
    repository: PropTypes.object,
    inline: PropTypes.bool,
  };

  getCommitUrl = () => {
    // TODO(jess): move this to plugins
    if (this.props.repository.provider.id === 'github') {
      return this.props.repository.url + '/commit/' + this.props.commitId;
    }
    if (this.props.repository.provider.id === 'bitbucket') {
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
        {repository.provider.id == 'github' && (
          <InlineSvg src="icon-github" style={{verticalAlign: 'text-top'}} size="14px" />
        )}
        {repository.provider.id == 'bitbucket' && (
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
