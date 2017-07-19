import React from 'react';
import {Link} from 'react-router';

import {getShortVersion} from '../utils';

const Version = React.createClass({
  propTypes: {
    anchor: React.PropTypes.bool,
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string,
    projectId: React.PropTypes.string
  },

  getDefaultProps() {
    return {
      anchor: true
    };
  },

  render() {
    let {orgId, projectId, version} = this.props;
    let shortVersion = getShortVersion(version);

    if (this.props.anchor) {
      return (
        // NOTE: version is encoded because it can contain slashes "/",
        //       which can interfere with URL construction
        (
          <Link to={`/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`}>
            <span title={version}>{shortVersion}</span>
          </Link>
        )
      );
    }
    return <span title={version}>{shortVersion}</span>;
  }
});

export default Version;
