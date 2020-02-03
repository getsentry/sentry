import PropTypes from 'prop-types';
import React from 'react';
import {Release} from '@sentry/release-parser';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';

type Props = {
  version: string;
  orgId: string;
  anchor?: boolean;
  /**
   * Should link to Release preserve user's global selection values
   */
  preserveGlobalSelection?: boolean;
  tooltipRawVersion?: boolean;
  className?: string;
};

export const VersionV2 = ({
  version,
  orgId,
  anchor = true,
  preserveGlobalSelection,
  tooltipRawVersion,
  className,
}: Props) => {
  const parsedVersion = new Release(version);
  const LinkComponent = preserveGlobalSelection ? GlobalSelectionLink : Link;

  const renderVersion = () => {
    if (anchor && orgId) {
      return (
        <LinkComponent
          to={`/organizations/${orgId}/releases-v2/${encodeURIComponent(
            parsedVersion.raw
          )}/`}
          className={className}
        >
          <span>{parsedVersion.describe()}</span>
        </LinkComponent>
      );
    }

    return <span className={className}>{parsedVersion.describe()}</span>;
  };

  return (
    <Tooltip title={parsedVersion.raw} disabled={!tooltipRawVersion} isHoverable>
      {renderVersion()}
    </Tooltip>
  );
};

VersionV2.propTypes = {
  version: PropTypes.string.isRequired,
  orgId: PropTypes.string,
  anchor: PropTypes.bool,
  /**
   * Should link to Release preserve user's global selection values
   */
  preserveGlobalSelection: PropTypes.bool,
  tooltipRawVersion: PropTypes.bool,
  className: PropTypes.string,
};

export default VersionV2;
