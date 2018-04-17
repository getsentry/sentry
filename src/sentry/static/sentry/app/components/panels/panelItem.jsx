import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

const StyledPanelItem = styled(Flex)`
  border-bottom: 1px solid ${p => p.theme.borderLight};

  &:last-child {
    border: 0;
  }
`;

class PanelItem extends React.Component {
  static propTypes = {
    p: PropTypes.number,
  };
  static defaultProps = {
    p: 2,
  };
  render() {
    return <StyledPanelItem {...this.props} />;
  }
}

export default PanelItem;
