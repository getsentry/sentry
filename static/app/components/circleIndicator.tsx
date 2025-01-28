import styled from '@emotion/styled';

type Props = {
  color?: string;
  /**
   * @default true
   */
  enabled?: boolean;
  /**
   * @default 14
   */
  size?: number;
};

const defaultProps = {
  enabled: true,
  size: 14,
};

const CircleIndicator = styled('div')<Props>`
  display: inline-block;
  position: relative;
  border-radius: 50%;
  height: ${p => p.size ?? defaultProps.size}px;
  width: ${p => p.size ?? defaultProps.size}px;
  background: ${p =>
    p.color ?? (p.enabled ?? defaultProps.enabled ? p.theme.success : p.theme.error)};
`;

export default CircleIndicator;
