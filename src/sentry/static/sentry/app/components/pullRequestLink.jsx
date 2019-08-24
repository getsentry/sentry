import PropTypes from 'prop-types';
import React from 'react';

import ExternalLink from 'app/components/links/externalLink';
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

    const id = this.props.repository.provider.id;
    if (id.indexOf(':') > -1) {
      return id.split(':').pop();
    }
    return id;
  }

  render() {
    const {pullRequest, repository} = this.props;
    const providerId = this.providerId;
    const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title}`;

    let icon = '';
    if (['github', 'gitlab', 'bitbucket'].indexOf(providerId) > -1) {
      icon = (
        <InlineSvg
          src={`icon-${providerId}`}
          style={{verticalAlign: 'text-top'}}
          size="14px"
        />
      );
    }

    return pullRequest.externalUrl ? (
      <ExternalLink
        className={this.props.inline ? 'inline-commit' : 'btn btn-default btn-sm'}
        href={pullRequest.externalUrl}
        target="_blank"
      >
        {icon}&nbsp; {this.props.inline ? '' : ' '}
        {displayId}
      </ExternalLink>
    ) : (
      <span>{displayId}</span>
    );
  }
}

export default PullRequestLink;
