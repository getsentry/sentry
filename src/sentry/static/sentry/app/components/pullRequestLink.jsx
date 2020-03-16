import PropTypes from 'prop-types';
import React from 'react';

import ExternalLink from 'app/components/links/externalLink';
import {IconBitbucket, IconGithub, IconGitlab} from 'app/icons';

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

  renderIcon() {
    const providerId = this.providerId;

    switch (providerId) {
      case 'github':
        return <IconGithub size="xs" />;
      case 'gitlab':
        return <IconGitlab size="xs" />;
      case 'bitbucket':
        return <IconBitbucket size="xs" />;
      default:
        return null;
    }
  }

  render() {
    const {pullRequest, repository} = this.props;
    const displayId = `${repository.name} #${pullRequest.id}: ${pullRequest.title}`;

    return pullRequest.externalUrl ? (
      <ExternalLink
        className={this.props.inline ? 'inline-commit' : 'btn btn-default btn-sm'}
        href={pullRequest.externalUrl}
        target="_blank"
      >
        {this.renderIcon()}
        {this.props.inline ? '' : ' '}
        {displayId}
      </ExternalLink>
    ) : (
      <span>{displayId}</span>
    );
  }
}

export default PullRequestLink;
