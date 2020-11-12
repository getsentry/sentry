import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import {trimPackage} from 'app/components/events/interfaces/frame/utils';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  withLeadHint: boolean;
  includeSystemFrames: boolean;
  packagePath: string | null;
  isClickable?: boolean;
};

class PackageLink extends React.Component<Props> {
  handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const {isClickable, onClick} = this.props;

    if (isClickable) {
      onClick(event);
    }
  };

  render() {
    const {
      packagePath,
      isClickable,
      withLeadHint,
      children,
      includeSystemFrames,
    } = this.props;

    return (
      <Package
        onClick={this.handleClick}
        isClickable={isClickable}
        withLeadHint={withLeadHint}
        includeSystemFrames={includeSystemFrames}
      >
        {defined(packagePath) ? (
          <Tooltip title={packagePath}>
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
}

const Package = styled('a')<Partial<Props>>`
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

  @media (min-width: ${p => p.theme.breakpoints[2]}) and (max-width: ${p =>
    p.theme.breakpoints[3]}) {
    ${p =>
      p.withLeadHint && (p.includeSystemFrames ? `max-width: 76px;` : `max-width: 63px;`)}
  }
`;

const PackageName = styled('span')<
  Pick<Props, 'isClickable' | 'withLeadHint' | 'includeSystemFrames'>
>`
  max-width: ${p =>
    p.withLeadHint && p.isClickable && !p.includeSystemFrames ? '45px' : '104px'};
  ${overflowEllipsis}
`;

export default PackageLink;
