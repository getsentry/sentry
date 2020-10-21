import {Component} from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';

class MenuItem extends Component {
  render() {
    const {children, ...props} = this.props;
    return <StyledMenuItem {...props}>{children}</StyledMenuItem>;
  }
}

const StyledMenuItem = styled('div')`
  font-size: 14px;
  ${overflowEllipsis};
`;

export default MenuItem;
