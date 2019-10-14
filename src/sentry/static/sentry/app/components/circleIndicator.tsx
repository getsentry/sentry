import PropTypes from 'prop-types';
import styled from 'react-emotion';

type Props = {
  enabled?: boolean;
  size: number;
  color?: string;
  theme?: any;
};

const getBackgroundColor = (p: Props) => {
  if (p.color) {
    return `background: ${p.color};`;
  }

  return `background: ${p.enabled ? p.theme.success : p.theme.error};`;
};

const getSize = (p: Props) => `
  height: ${p.size}px;
  width: ${p.size}px;
`;

const CircleIndicator = styled('div')<Props>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  ${getSize};
  ${getBackgroundColor};
`;

CircleIndicator.propTypes = {
  enabled: PropTypes.bool.isRequired,
  size: PropTypes.number.isRequired,
  color: PropTypes.string,
};

CircleIndicator.defaultProps = {
  enabled: true,
  size: 14,
};

export default CircleIndicator;
