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
    showShortVersion: PropTypes.bool,
  };

  static defaultProps = {
    anchor: true,
    showShortVersion: true,
  };

  render() {
    let {orgId, projectId, showShortVersion, version} = this.props;
    let versionTitle = showShortVersion ? getShortVersion(version) : version;

    if (this.props.anchor) {
      return (
        // NOTE: version is encoded because it can contain slashes "/",
        //       which can interfere with URL construction
        <ProjectLink
          to={`/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`}
        >
          <span title={version}>{versionTitle}</span>
        </ProjectLink>
      );
    }
    return <span title={version}>{versionTitle}</span>;
  }
}

export default Version;
