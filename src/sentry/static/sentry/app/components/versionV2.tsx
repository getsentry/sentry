import PropTypes from 'prop-types';
import React from 'react';
import {Release} from '@sentry/release-parser';
import styled from '@emotion/styled';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';

type Props = {
  version: string;
  anchor?: boolean;
  orgId?: string;
  /**
   * Should link to Release preserve user's global selection values
   */
  preserveGlobalSelection?: boolean;
  tooltipRawVersion?: boolean;
  /**
   * Will add project project ID to the linked url
   */
  projectId?: string;
  className?: string;
  truncate?: boolean;
};

const Version = ({
  version,
  orgId,
  anchor = true,
  preserveGlobalSelection,
  tooltipRawVersion,
  projectId,
  className,
  truncate,
}: Props) => {
  const parsedVersion = new Release(version);
  const LinkComponent = preserveGlobalSelection ? GlobalSelectionLink : Link;

  const renderVersion = () => {
    if (anchor && orgId) {
      return (
        <LinkComponent
          to={{
            pathname: `/organizations/${orgId}/releases/${encodeURIComponent(
              parsedVersion.raw
            )}/`,
            query: {project: projectId},
          }}
          className={className}
        >
          <VersionText truncate={truncate}>{parsedVersion.describe()}</VersionText>
        </LinkComponent>
      );
    }

    return (
      <VersionText className={className} truncate={truncate}>
        {parsedVersion.describe()}
      </VersionText>
    );
  };

  return (
    <Tooltip title={parsedVersion.raw} disabled={!tooltipRawVersion} isHoverable>
      {renderVersion()}
    </Tooltip>
  );
};

const VersionText = styled('span')<{truncate?: boolean}>`
  ${p =>
    p.truncate &&
    `max-width: 100%;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;`}
`;

Version.propTypes = {
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

export default Version;
