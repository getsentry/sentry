import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Link from 'app/components/links/link';
import Tooltip from 'app/components/tooltip';
import {IconCopy} from 'app/icons';
import Clipboard from 'app/components/clipboard';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {formatVersion} from 'app/utils/formatters';

type Props = {
  /**
   * Raw version (canonical release identifier)
   */
  version: string;
  /**
   * Should the version be a link to the release page
   */
  anchor?: boolean;
  /**
   * Organization id needed for linking to release page
   */
  orgId?: string;
  /**
   * Should link to Release preserve user's global selection values
   */
  preserveGlobalSelection?: boolean;
  /**
   * Should there be a tooltip with raw version on hover
   */
  tooltipRawVersion?: boolean;
  /**
   * Should we also show package name
   */
  withPackage?: boolean;
  /**
   * Will add project project ID to the linked url
   */
  projectId?: string;
  /**
   * Ellipsis on overflow
   */
  truncate?: boolean;
  className?: string;
};

const Version = ({
  version,
  orgId,
  anchor = true,
  preserveGlobalSelection,
  tooltipRawVersion,
  withPackage,
  projectId,
  className,
  truncate,
}: Props) => {
  const LinkComponent = preserveGlobalSelection ? GlobalSelectionLink : Link;
  const versionToDisplay = formatVersion(version, withPackage);

  const renderVersion = () => {
    if (anchor && orgId) {
      return (
        <LinkComponent
          to={{
            pathname: `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`,
            query: projectId ? {project: projectId} : undefined,
          }}
          className={className}
        >
          <VersionText truncate={truncate}>{versionToDisplay}</VersionText>
        </LinkComponent>
      );
    }

    return (
      <VersionText className={className} truncate={truncate}>
        {versionToDisplay}
      </VersionText>
    );
  };

  const renderTooltipContent = () => {
    return (
      <TooltipContent
        onClick={e => {
          e.stopPropagation();
        }}
      >
        <TooltipVersionWrapper>{version}</TooltipVersionWrapper>

        <Clipboard value={version}>
          <TooltipClipboardIconWrapper>
            <IconCopy size="xs" color="white" />
          </TooltipClipboardIconWrapper>
        </Clipboard>
      </TooltipContent>
    );
  };

  return (
    <Tooltip
      title={renderTooltipContent()}
      disabled={!tooltipRawVersion}
      isHoverable
      containerDisplayMode={truncate ? 'block' : 'inline-block'}
    >
      {renderVersion()}
    </Tooltip>
  );
};

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
  projectId: PropTypes.string,
  truncate: PropTypes.bool,
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

const TooltipContent = styled('span')`
  display: flex;
  align-items: center;
`;

const TooltipVersionWrapper = styled('span')`
  ${overflowEllipsis}
`;

const TooltipClipboardIconWrapper = styled('span')`
  margin-left: ${space(0.5)};
  position: relative;
  bottom: -${space(0.25)};

  &:hover {
    cursor: pointer;
  }
`;

export default Version;
