import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {Organization} from 'sentry/types';
import {formatVersion} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';
import {useLocation} from 'sentry/utils/useLocation';
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

function Version({
  version,
  organization,
  anchor = true,
  preservePageFilters,
  tooltipRawVersion,
  withPackage,
  projectId,
  truncate,
  className,
}: Props) {
  const location = useLocation();
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
      <CopyToClipboardButton borderless text={version} size="zero" iconSize="xs" />
    </TooltipContent>
  );

  const getOverlayStyle = () => {
    // if the version name is not a hash (sha1 or sha265) and we are not on
    // mobile, allow tooltip to be as wide as 500px
    if (/(^[a-f0-9]{40}$)|(^[a-f0-9]{64}$)/.test(version)) {
      return undefined;
    }

    return css`
      @media (min-width: ${theme.breakpoints.small}) {
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
      overlayStyle={getOverlayStyle()}
    >
      {renderVersion()}
    </Tooltip>
  );
}

// TODO(matej): try to wrap version with this when truncate prop is true (in separate PR)
// const VersionWrapper = styled('div')`
//   ${p => p.theme.overflowEllipsis};
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
  ${p => p.theme.overflowEllipsis}
`;

export default withOrganization(Version);
