import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';
import {defined} from 'app/utils';
import {trimPackage} from 'app/components/events/interfaces/frame';
import InlineSvg from 'app/components/inlineSvg';

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
        {children}

        {defined(packagePath) ? (
          <Tooltip title={packagePath}>
            <span>{trimPackage(packagePath)}</span>
          </Tooltip>
        ) : (
          <span>{'<unknown>'}</span>
        )}

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
  max-width: 100%;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-basis: 120px;
  flex-grow: 0;
  flex-shrink: 0;
  padding: 0 ${space(0.5)};
  color: ${p => p.theme.foreground};
  cursor: ${p => (p.isClickable ? 'pointer' : 'default')};

  &:hover {
    color: ${p => p.theme.foreground};

    ${LinkChevron} {
      opacity: 1;
      transform: translateX(${space(0.5)});
    }
  }
`;

export default PackageLink;
