import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Clipboard from 'sentry/components/clipboard';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import Link from 'sentry/components/links/link';
import Tooltip from 'sentry/components/tooltip';
import {IconCopy} from 'sentry/icons';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  /**
   *  Organization injected by withOrganization HOC
   */
  organization: Organization;
  /**
   * Raw version (canonical release identifier)
   */
  version: string;
  /**
   * Should the version be a link to the release page
   */
  anchor?: boolean;
  className?: string;
  /**
   * Should link to release page preserve user's page filter values
   */
  preservePageFilters?: boolean;
  /**
   * Will add project ID to the linked url (can be overridden by preservePageFilters).
   * If not provided and user does not have global-views enabled, it will try to take it from current url query.
   */
  projectId?: string;
  /**
   * Should there be a tooltip with raw version on hover
   */
  tooltipRawVersion?: boolean;
  /**
   * Ellipsis on overflow
   */
  truncate?: boolean;
  /**
   * Should we also show package name
   */
  withPackage?: boolean;
};

const Version = ({
  version,
  organization,
  anchor = true,
  preservePageFilters,
  tooltipRawVersion,
  withPackage,
  projectId,
  truncate,
  className,
  location,
}: WithRouterProps & Props) => {
  const versionToDisplay = formatVersion(version, withPackage);

  let releaseDetailProjectId: null | undefined | string | string[];
  if (projectId) {
    // we can override preservePageFilters's project id
    releaseDetailProjectId = projectId;
  } else if (!organization?.features.includes('global-views')) {
    // we need this for users without global-views, otherwise they might get `This release may not be in your selected project`
    releaseDetailProjectId = location?.query.project;
  }

  const renderVersion = () => {
    if (anchor && organization?.slug) {
      const props = {
        to: {
          pathname: `/organizations/${organization?.slug}/releases/${encodeURIComponent(
            version
          )}/`,
          query: releaseDetailProjectId ? {project: releaseDetailProjectId} : undefined,
        },
        className,
      };
      if (preservePageFilters) {
        return (
          <GlobalSelectionLink {...props}>
            <VersionText truncate={truncate}>{versionToDisplay}</VersionText>
          </GlobalSelectionLink>
        );
      }
      return (
        <Link {...props}>
          <VersionText truncate={truncate}>{versionToDisplay}</VersionText>
        </Link>
      );
    }

    return (
      <VersionText className={className} truncate={truncate}>
        {versionToDisplay}
      </VersionText>
    );
  };

  const renderTooltipContent = () => (
    <TooltipContent
      onClick={e => {
        e.stopPropagation();
      }}
    >
      <TooltipVersionWrapper>{version}</TooltipVersionWrapper>

      <Clipboard value={version}>
        <TooltipClipboardIconWrapper>
          <IconCopy size="xs" />
        </TooltipClipboardIconWrapper>
      </Clipboard>
    </TooltipContent>
  );

  const getPopperStyles = () => {
    // if the version name is not a hash (sha1 or sha265) and we are not on mobile, allow tooltip to be as wide as 500px
    if (/(^[a-f0-9]{40}$)|(^[a-f0-9]{64}$)/.test(version)) {
      return undefined;
    }

    return css`
      @media (min-width: ${theme.breakpoints[0]}) {
        max-width: 500px;
      }
    `;
  };

  return (
    <Tooltip
      title={renderTooltipContent()}
      disabled={!tooltipRawVersion}
      isHoverable
      containerDisplayMode={truncate ? 'block' : 'inline-block'}
      popperStyle={getPopperStyles()}
    >
      {renderVersion()}
    </Tooltip>
  );
};

// TODO(matej): try to wrap version with this when truncate prop is true (in separate PR)
// const VersionWrapper = styled('div')`
//   ${overflowEllipsis};
//   max-width: 100%;
//   width: auto;
//   display: inline-block;
// `;

const VersionText = styled('span')<{truncate?: boolean}>`
  ${p =>
    p.truncate &&
    `max-width: 100%;
    display: block;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
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

type PropsWithoutOrg = Omit<Props, 'organization'>;

export default withOrganization(
  withRouter(Version)
) as React.ComponentClass<PropsWithoutOrg>;
