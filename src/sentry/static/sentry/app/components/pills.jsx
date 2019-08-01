import React from 'react';
import styled from 'react-emotion';

class Pills extends React.Component {
  render() {
    const {children, ...otherProps} = this.props;
    return <StyledPills {...otherProps}>{children}</StyledPills>;
  }
}

const StyledPills = styled('div')`
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
`;

export default Pills;
