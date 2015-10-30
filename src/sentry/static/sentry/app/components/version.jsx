import React from 'react';
import {Link} from 'react-router';

const Version = React.createClass({
  propTypes: {
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  getDefaultProps() {
    return {
      anchor: true
    };
  },

  render() {
    // NOTE: version is encoded because it can contain slashes "/",
    //       which can interfere with URL construction
    let version = encodeURIComponent(this.props.version);
    let shortVersion = version.length === 40 ? version.substr(0, 12) : version;

    let {orgId, projectId} = this.props;

    if (this.props.anchor) {
      return (
        <Link to={`/${orgId}/${projectId}/releases/${version}/`}>
          <span title={version}>{shortVersion}</span>
        </Link>
      );
    }
    return <span title={version}>{shortVersion}</span>;
  }
});

export default Version;

