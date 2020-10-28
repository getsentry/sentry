import styled from '@emotion/styled';

const LoadingMask = styled('div')`
  background-color: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

export default LoadingMask;
