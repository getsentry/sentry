import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import {trimPackage} from 'app/components/events/interfaces/frame/utils';
import InlineSvg from 'app/components/inlineSvg';
import {PackageStatusIcon} from 'app/components/events/interfaces/packageStatus';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  packagePath: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  isClickable: boolean;
};

class PackageLink extends React.Component<Props> {
  handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const {isClickable, onClick} = this.props;

    if (isClickable) {
      onClick(event);
    }
  };

  render() {
    const {packagePath, isClickable, children} = this.props;

    return (
      <Package onClick={this.handleClick} isClickable={isClickable}>
        {defined(packagePath) ? (
          <Tooltip title={packagePath}>
            <TooltipContent>{trimPackage(packagePath)}</TooltipContent>
          </Tooltip>
        ) : (
          <span>{'<unknown>'}</span>
        )}
        {children}
        {isClickable && <LinkChevron src="icon-chevron-right" />}
      </Package>
    );
  }
}

const LinkChevron = styled(InlineSvg)`
  opacity: 0;
  transform: translateX(${space(0.25)});
  transition: all 0.2s ease-in-out;
`;

const Package = styled('a')<Partial<Props>>`
  font-size: 13px;
  font-weight: bold;
  padding: 0 0 0 ${space(0.5)};
  color: ${p => p.theme.foreground};
  cursor: ${p => (p.isClickable ? 'pointer' : 'default')};
  &:hover {
    color: ${p => p.theme.foreground};
    ${LinkChevron} {
      opacity: 1;
      transform: translateX(${space(0.5)});
    }
    &:hover ${PackageStatusIcon} {
      opacity: 1;
    }
  }
  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    ${overflowEllipsis}
  }
`;

const TooltipContent = styled('span')`
  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    ${overflowEllipsis}
  }
`;

export default PackageLink;
