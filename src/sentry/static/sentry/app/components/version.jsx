import PropTypes from 'prop-types';
import React from 'react';

import {getShortVersion} from 'app/utils';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Link from 'app/components/links/link';
import withOrganization from 'app/utils/withOrganization';

class Version extends React.Component {
  static propTypes = {
    anchor: PropTypes.bool,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string,
    showShortVersion: PropTypes.bool,

    /**
     * Should link to Release preserve user's global selection values
     */
    preserveGlobalSelection: PropTypes.bool,
  };

  static defaultProps = {
    anchor: true,
    showShortVersion: true,
  };

  render() {
    const {
      orgId,
      showShortVersion,
      version,
      anchor,
      className,
      preserveGlobalSelection,
    } = this.props;

    const versionTitle = showShortVersion ? getShortVersion(version) : version;
    const LinkComponent = preserveGlobalSelection ? GlobalSelectionLink : Link;

    if (anchor && orgId) {
      return (
        <LinkComponent
          to={`/organizations/${orgId}/releases/${encodeURIComponent(version)}/`}
          className={className}
        >
          <span title={version}>{versionTitle}</span>
        </LinkComponent>
      );
    }

    return <span title={version}>{versionTitle}</span>;
  }
}

export default withOrganization(Version);
