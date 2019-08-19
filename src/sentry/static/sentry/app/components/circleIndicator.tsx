import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

export type Props = {
  enabled: boolean;
  size: number;
  color: string;
};

const getBackgroundColor = (p: Props): string => {
  if (p.color) {
    return `background: ${p.color};`;
  }

  return `background: ${p.enabled ? p.theme.success : p.theme.error};`;
};

const getSize = (p: any): string => `
  height: ${p.size}px;
  width: ${p.size}px;
`;

const Circle = styled('div')`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  ${getSize};
  ${getBackgroundColor};
`;

class CircleIndicator extends React.Component<Props> {
  static propTypes = {
    enabled: PropTypes.bool.isRequired,
    size: PropTypes.number.isRequired,
    color: PropTypes.string,
  };

  static defaultProps = {
    enabled: true,
    size: 14,
  };

  constructor(props: Props) {
    super(props);
  }

  render() {
    return <Circle {...this.props} />;
  }
}

export default CircleIndicator;
