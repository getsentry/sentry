import React from 'react';
import styled from 'react-emotion';

import overflowEllipsis from 'app/styles/overflowEllipsis';

class MenuItem extends React.Component {
  render() {
    let {children, ...props} = this.props;
    return <StyledMenuItem {...props}>{children}</StyledMenuItem>;
  }
}

const StyledMenuItem = styled('div')`
  font-size: 14px;
  ${overflowEllipsis};
`;

export default MenuItem;
