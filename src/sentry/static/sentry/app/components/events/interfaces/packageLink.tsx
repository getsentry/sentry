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
  withLeadHint: boolean;
};

class PackageLink extends React.Component<Props> {
  handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const {isClickable, onClick} = this.props;

    if (isClickable) {
      onClick(event);
    }
  };

  render() {
    const {packagePath, isClickable, withLeadHint, children} = this.props;

    return (
      <Package
        onClick={this.handleClick}
        isClickable={isClickable}
        withLeadHint={withLeadHint}
      >
        {defined(packagePath) ? (
          <Tooltip title={packagePath}>
            <PackageName>{trimPackage(packagePath)}</PackageName>
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
  vertical-align: top;
`;

const PackageName = styled('span')`
  ${overflowEllipsis}
`;

const Package = styled('a')<Partial<Props> & {withLeadHint: boolean}>`
  font-size: 13px;
  font-weight: bold;
  padding: 0 0 0 ${space(0.5)};
  color: ${p => p.theme.foreground};
  cursor: ${p => (p.isClickable ? 'pointer' : 'default')};
  ${PackageStatusIcon} {
    opacity: 1;
  }
  &:hover {
    color: ${p => p.theme.foreground};
    ${LinkChevron} {
      opacity: 1;
      transform: translateX(${space(0.5)});
    }
    ${PackageStatusIcon} {
      opacity: 1;
    }
  }
  display: flex;
  align-items: center;
  ${p => p.withLeadHint && `max-width: 76px;`}
  ${PackageName} {
    max-width: ${p => (p.withLeadHint && p.isClickable ? '45px' : '104px')};
  }
`;

export default PackageLink;
