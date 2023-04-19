import styled from '@emotion/styled';

import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

type Props = {
  includeSystemFrames: boolean;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  packagePath: string | null;
  withLeadHint: boolean;
  isClickable?: boolean;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
};

function PackageLink({
  children,
  includeSystemFrames,
  isClickable,
  isHoverPreviewed,
  onClick,
  packagePath,
  withLeadHint,
}) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isClickable) {
      onClick(event);
    }
  };

  return (
    <Package
      onClick={handleClick}
      isClickable={isClickable}
      withLeadHint={withLeadHint}
      includeSystemFrames={includeSystemFrames}
    >
      {defined(packagePath) ? (
        <Tooltip
          title={packagePath}
          delay={isHoverPreviewed ? SLOW_TOOLTIP_DELAY : undefined}
        >
          <PackageName
            isClickable={isClickable}
            withLeadHint={withLeadHint}
            includeSystemFrames={includeSystemFrames}
          >
            {trimPackage(packagePath)}
          </PackageName>
        </Tooltip>
      ) : (
        <span>{'<unknown>'}</span>
      )}
      {children}
    </Package>
  );
}

export const Package = styled('a')<Partial<Props>>`
  font-size: 13px;
  font-weight: bold;
  padding: 0 0 0 ${space(0.5)};
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
  cursor: ${p => (p.isClickable ? 'pointer' : 'default')};
  display: flex;
  align-items: center;

  ${p =>
    p.withLeadHint && (p.includeSystemFrames ? `max-width: 89px;` : `max-width: 76px;`)}

  @media (min-width: ${p => p.theme.breakpoints.large}) and (max-width: ${p =>
    p.theme.breakpoints.xlarge}) {
    ${p =>
      p.withLeadHint && (p.includeSystemFrames ? `max-width: 76px;` : `max-width: 63px;`)}
  }
`;

export const PackageName = styled('span')<
  Pick<Props, 'isClickable' | 'withLeadHint' | 'includeSystemFrames'>
>`
  max-width: ${p =>
    p.withLeadHint && p.isClickable && !p.includeSystemFrames ? '45px' : '104px'};
  ${p => p.theme.overflowEllipsis}
`;

export default PackageLink;
