import PropTypes from 'prop-types';
import React from 'react';

import InlineSvg from 'app/components/inlineSvg';

class PullRequestLink extends React.Component {
  static propTypes = {
    pullRequest: PropTypes.object,
    repository: PropTypes.object,
    inline: PropTypes.bool,
  };

  get providerId() {
    if (!this.props.repository.provider) {
      return null;
    }

    let id = this.props.repository.provider.id;
    if (id.indexOf(':') > -1) {
      return id.split(':').pop();
    }
    return id;
  }

  get url() {
    let providerId = this.providerId;
    if (providerId === 'github') {
      return this.props.repository.url + '/pull/' + this.props.pullRequest.id;
    }
    if (providerId === 'gitlab') {
      return this.props.repository.url + '/merge_requests/' + this.props.pullRequest.id;
    }
    return undefined;
  }

  render() {
    let url = this.url;
    let displayId = `${this.props.repository.name} #${this.props.pullRequest.id}: ${this
      .props.pullRequest.title}`;
    let providerId = this.providerId;

    return url ? (
      <a
        className={this.props.inline ? 'inline-commit' : 'btn btn-default btn-sm'}
        href={url}
        target="_blank"
      >
        {providerId == 'github' && (
          <InlineSvg src="icon-github" style={{verticalAlign: 'text-top'}} size="14px" />
        )}
        {providerId == 'bitbucket' && (
          <InlineSvg
            src="icon-bitbucket"
            style={{verticalAlign: 'text-top'}}
            size="14px"
          />
        )}
        {providerId == 'gitlab' && (
          <InlineSvg src="icon-gitlab" style={{verticalAlign: 'text-top'}} size="14px" />
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
