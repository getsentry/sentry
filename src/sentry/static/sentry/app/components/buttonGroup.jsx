import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

// This is so we can use this as a selector in other components (e.g. <Button>)
const ButtonGroup = styled(
  class ButtonGroupComponent extends React.Component {
    render() {
      return <Flex {...this.props} />;
    }
  }
)``;

export default ButtonGroup;
