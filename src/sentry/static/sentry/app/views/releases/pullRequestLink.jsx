import PropTypes from 'prop-types';
import React from 'react';

import IconGithub from '../../icons/icon-github';
import IconBitbucket from '../../icons/icon-bitbucket';

const PullRequestLink = React.createClass({
  propTypes: {
    pullRequestId: PropTypes.string,
    repository: PropTypes.object,
    inline: PropTypes.bool,
  },

  getUrl() {
    if (this.props.repository.provider.id === 'github') {
      return this.props.repository.url + '/pull/' + this.props.pullRequestId;
    }
    return undefined;
  },

  render() {
    let url = this.getUrl();
    let displayId = `#${this.props.pullRequestId}`;

    return url ? (
      <a
        className={this.props.inline ? 'inline-commit' : 'btn btn-default btn-sm'}
        href={url}
        target="_blank"
      >
        {this.props.repository.provider.id == 'github' && (
          <IconGithub size="16" style={{verticalAlign: 'text-top'}} />
        )}
        {this.props.repository.provider.id == 'bitbucket' && (
          <IconBitbucket size="16" style={{verticalAlign: 'text-top'}} />
        )}
        &nbsp;
        {this.props.inline ? '' : ' '}
        {displayId}
      </a>
    ) : (
      <span>{displayId}</span>
    );
  },
});
export default PullRequestLink;
