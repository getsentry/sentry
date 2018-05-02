import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

const getBackgroundColor = p => `
  background: ${p.enabled ? p.theme.success : p.theme.error};
`;

const getSize = p => `
  border-radius: ${p.size}px;
  height: ${p.size}px;
  width: ${p.size}px;
`;

const Circle = styled.div`
  display: inline-block;
  position: relative;
  ${getSize} ${getBackgroundColor};
`;

class CircleIndicator extends React.Component {
  static propTypes = {
    enabled: PropTypes.bool.isRequired,
    size: PropTypes.number.isRequired,
  };

  static defaultProps = {
    enabled: true,
    size: 14,
  };

  constructor(props) {
    super(props);
  }

  render() {
    return <Circle {...this.props} />;
  }
}

export default CircleIndicator;
