import styled from '@emotion/styled';

export interface LoadingMaskProps extends React.HTMLAttributes<HTMLDivElement> {}

const LoadingMask = styled('div')<LoadingMaskProps>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

export default LoadingMask;
