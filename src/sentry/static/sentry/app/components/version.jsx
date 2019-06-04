import PropTypes from 'prop-types';
import React from 'react';

import Link from 'app/components/links/link';
import {getShortVersion} from 'app/utils';
import withOrganization from 'app/utils/withOrganization';

class Version extends React.Component {
  static propTypes = {
    anchor: PropTypes.bool,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string,
    showShortVersion: PropTypes.bool,
  };

  static defaultProps = {
    anchor: true,
    showShortVersion: true,
  };

  render() {
    const {orgId, showShortVersion, version, anchor, className} = this.props;
    const versionTitle = showShortVersion ? getShortVersion(version) : version;

    if (anchor) {
      if (orgId) {
        return (
          <Link
            to={`/organizations/${orgId}/releases/${encodeURIComponent(version)}`}
            className={className}
          >
            <span title={version}>{versionTitle}</span>
          </Link>
        );
      }
    }
    return <span title={version}>{versionTitle}</span>;
  }
}

export default withOrganization(Version);
