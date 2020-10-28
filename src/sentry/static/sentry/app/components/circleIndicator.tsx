import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {Theme} from 'app/utils/theme';

const defaultProps = {
  enabled: true,
  size: 14,
};

type DefaultProps = Readonly<typeof defaultProps>;

type Props = {
  color?: string;
} & Partial<DefaultProps>;

const getBackgroundColor = (p: Props & {theme: Theme}) => {
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

CircleIndicator.defaultProps = defaultProps;

export default CircleIndicator;
