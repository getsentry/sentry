import React from 'react';

import VersionModalLink from '../components/versionModalLink';
import {getShortVersion} from '../utils';

const Version = React.createClass({
  propTypes: {
    anchor: React.PropTypes.bool,
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
  },

  getDefaultProps() {
    return {
      anchor: true,
    };
  },

  render() {
    let {orgId, projectId, version} = this.props;
    let shortVersion = getShortVersion(version);

    if (this.props.anchor) {
      return (
        <VersionModalLink orgId={orgId} projectId={projectId} version={version} />
      );
    }
    return <span title={version}>{shortVersion}</span>;
  }
});

export default Version;
