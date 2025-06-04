import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const Spinner = styled('div')`
  animation: ${spin} 0.4s linear infinite;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid ${p => p.theme.border};
  border-left-color: ${p => p.theme.purple300};
  margin-left: auto;
`;

export default Spinner;
