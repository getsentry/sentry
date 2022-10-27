import styled from '@emotion/styled';

type Props = {
  color?: string;
  enabled?: boolean;
  size?: number;
};

const CircleIndicator = styled('div')<Props>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  background: ${p => p.color ?? (p.enabled ? p.theme.success : p.theme.error)};
`;

CircleIndicator.defaultProps = {
  enabled: true,
  size: 14,
};

export default CircleIndicator;
