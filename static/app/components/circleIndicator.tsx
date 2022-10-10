import styled from '@emotion/styled';

type Props = {
  color?: string;
  enabled?: boolean;
  size?: number;
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
  background: ${p => p.color ?? (p.enabled ? p.theme.success : p.theme.error)};
`;

CircleIndicator.defaultProps = {
  enabled: true,
  size: 14,
};

export default CircleIndicator;
