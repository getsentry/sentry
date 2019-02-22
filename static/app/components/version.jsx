import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import ProjectLink from 'app/components/projectLink';
import Link from 'app/components/link';
import {getShortVersion} from 'app/utils';
import withOrganization from 'app/utils/withOrganization';

class Version extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
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
    const {
      organization,
      orgId,
      projectId,
      showShortVersion,
      version,
      anchor,
    } = this.props;
    const versionTitle = showShortVersion ? getShortVersion(version) : version;

    const hasSentry10 = new Set(organization.features).has('sentry10');

    if (anchor) {
      if (projectId && !hasSentry10) {
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

      if (orgId) {
        return (
          <Link to={`/organizations/${orgId}/releases/${encodeURIComponent(version)}`}>
            <span title={version}>{versionTitle}</span>
          </Link>
        );
      }
    }
    return <span title={version}>{versionTitle}</span>;
  }
}

export default withOrganization(Version);
