import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {makeReleaseDrawerPathname} from 'sentry/views/releases/utils/pathnames';

type Props = {
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
   */
  projectId?: string;
  /**
   * Should the version be formatted or not
   */
  shouldFormatVersion?: boolean;
  /**
   * Should the release text break and wrap onto the next line
   */
  shouldWrapText?: boolean;
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
  anchor = true,
  preservePageFilters,
  tooltipRawVersion,
  withPackage,
  projectId,
  truncate,
  shouldWrapText = false,
  className,
  shouldFormatVersion = true,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const versionToDisplay = shouldFormatVersion
    ? formatVersion(version, withPackage)
    : version;
  const theme = useTheme();

  let releaseDetailProjectId: null | undefined | string | string[];
  if (projectId) {
    // we can override preservePageFilters's project id
    releaseDetailProjectId = projectId;
  }

  const renderVersion = () => {
    if (anchor && organization?.slug) {
      const props = {
        to: makeReleaseDrawerPathname({
          location,
          release: version,
          projectId: releaseDetailProjectId,
          source: 'release-version-link',
        }),
        className,
      };
      if (preservePageFilters) {
        return (
          <GlobalSelectionLink {...props}>
            <VersionText truncate={truncate} shouldWrapText={shouldWrapText}>
              {versionToDisplay}
            </VersionText>
          </GlobalSelectionLink>
        );
      }
      return (
        <Link {...props}>
          <VersionText truncate={truncate} shouldWrapText={shouldWrapText}>
            {versionToDisplay}
          </VersionText>
        </Link>
      );
    }

    return (
      <VersionText
        className={className}
        truncate={truncate}
        shouldWrapText={shouldWrapText}
      >
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
      <CopyToClipboardButton borderless text={version} size="zero" />
    </TooltipContent>
  );

  const getOverlayStyle = () => {
    // if the version name is not a hash (sha1 or sha265) and we are not on
    // mobile, allow tooltip to be as wide as 500px
    if (/(^[a-f0-9]{40}$)|(^[a-f0-9]{64}$)/.test(version)) {
      return undefined;
    }

    return css`
      @media (min-width: ${theme.breakpoints.sm}) {
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

const truncateStyles = css`
  max-width: 100%;
  display: block;
  overflow: hidden;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
`;

const VersionText = styled('span')<{
  shouldWrapText?: boolean;
  truncate?: boolean;
}>`
  ${p => p.truncate && truncateStyles}
  white-space: ${p => (p.shouldWrapText ? 'normal' : 'nowrap')};
`;

const TooltipContent = styled('span')`
  display: flex;
  align-items: center;
`;

const TooltipVersionWrapper = styled('span')`
  ${p => p.theme.overflowEllipsis}
`;

export default Version;
