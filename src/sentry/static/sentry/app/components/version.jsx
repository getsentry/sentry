import PropTypes from 'prop-types';
import React from 'react';

import ProjectLink from 'app/components/projectLink';
import {getShortVersion} from 'app/utils';

class Version extends React.Component {
  static propTypes = {
    anchor: PropTypes.bool,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string,
    projectId: PropTypes.string,
  };

  static defaultProps = {
    anchor: true,
  };

  render() {
    let {orgId, projectId, version} = this.props;
    let shortVersion = getShortVersion(version);

    if (this.props.anchor) {
      return (
        // NOTE: version is encoded because it can contain slashes "/",
        //       which can interfere with URL construction
        <ProjectLink
          to={`/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`}
        >
          <span title={version}>{shortVersion}</span>
        </ProjectLink>
      );
    }
    return <span title={version}>{shortVersion}</span>;
  }
}

export default Version;
