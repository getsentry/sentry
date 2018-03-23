import React from 'react';
import styled from 'react-emotion';

import TextOverflow from '../../../../components/textOverflow';

class MenuItem extends React.Component {
  render() {
    let {children, ...props} = this.props;
    return (
      <StyledMenuItem {...props}>
        <TextOverflow>{children}</TextOverflow>
      </StyledMenuItem>
    );
  }
}

const StyledMenuItem = styled('div')`
  font-size: 14px;
`;

export default MenuItem;
