import styled from 'react-emotion';

const LoadingMask = styled('div')`
  background-color: ${p => p.theme.offWhite};
  border-radius: ${p => p.theme.borderRadius};
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
`;

export default LoadingMask;
