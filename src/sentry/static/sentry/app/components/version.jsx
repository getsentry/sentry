import PropTypes from 'prop-types';
import React from 'react';

import ProjectLink from 'app/components/projectLink';
import Link from 'app/components/link';
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
    const {orgId, projectId, showShortVersion, version, anchor} = this.props;
    const versionTitle = showShortVersion ? getShortVersion(version) : version;

    if (anchor) {
      if (projectId) {
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
      return (
        <Link to={`/organizations/${orgId}/releases/${encodeURIComponent(version)}`}>
          <span title={version}>{versionTitle}</span>
        </Link>
      );
    }
    return <span title={version}>{versionTitle}</span>;
  }
}

export default Version;
