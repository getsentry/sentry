import PropTypes from 'prop-types';
import React from 'react';

import InlineSvg from 'app/components/inlineSvg';

class PullRequestLink extends React.Component {
  static propTypes = {
    pullRequest: PropTypes.object,
    repository: PropTypes.object,
    inline: PropTypes.bool,
  };

  getUrl = () => {
    if (this.props.repository.provider.id === 'github') {
      return this.props.repository.url + '/pull/' + this.props.pullRequest.id;
    }
    return undefined;
  };

  render() {
    let url = this.getUrl();
    let displayId = `${this.props.repository.name} #${this.props.pullRequest.id}: ${this
      .props.pullRequest.title}`;

    return url ? (
      <a
        className={this.props.inline ? 'inline-commit' : 'btn btn-default btn-sm'}
        href={url}
        target="_blank"
      >
        {this.props.repository.provider.id == 'github' && (
          <InlineSvg src="icon-github" style={{verticalAlign: 'text-top'}} size="14px" />
        )}
        {this.props.repository.provider.id == 'bitbucket' && (
          <InlineSvg
            src="icon-bitbucket"
            style={{verticalAlign: 'text-top'}}
            size="14px"
          />
        )}
        &nbsp;
        {this.props.inline ? '' : ' '}
        {displayId}
      </a>
    ) : (
      <span>{displayId}</span>
    );
  }
}

export default PullRequestLink;
