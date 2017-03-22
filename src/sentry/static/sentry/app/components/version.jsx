import React from 'react';
import {Link} from 'react-router';

import HoverCard from './hoverCard';

const Version = React.createClass({
  propTypes: {
    anchor: React.PropTypes.bool,
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    onIssuePage: React.PropTypes.bool,
  },

  contextTypes: {
    organization: React.PropTypes.object,
  },

  getDefaultProps() {
    return {
      anchor: true,
      onIssuePage: false,
    };
  },

  getInitialState() {
    return {
      showHovercard: false,
      mountHovercard: false,
    };
  },

  toggleHovercard () {
    this.setState({
      showHovercard: !this.state.showHovercard,
      mountHovercard: true,
    });
  },

  render() {
    let {orgId, projectId, version} = this.props;
    let shortVersion = version.match(/^[a-f0-9]{40}$/) ? version.substr(0, 12) : version;

    if (this.props.anchor) {
      return (
        // NOTE: version is encoded because it can contain slashes "/",
        //       which can interfere with URL construction
        <span onMouseEnter={this.toggleHovercard} onMouseLeave={this.toggleHovercard}>
          <Link to={`/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`}>
          <span title={version}>{shortVersion}</span>
          </Link>
          {this.state.mountHovercard && this.props.onIssuePage && new Set(this.context.organization.features).has('release-commits') &&
            <HoverCard visible={this.state.showHovercard} orgId={orgId} projectId={projectId} version={version} />
          }
        </span>
      );
    }
    return <span title={version}>{shortVersion}</span>;
  }
});

export default Version;
