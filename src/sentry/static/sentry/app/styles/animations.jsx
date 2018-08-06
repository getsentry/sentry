import {keyframes} from 'react-emotion';

export const growIn = keyframes`
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
`;

export const fadeOut = keyframes`
  0% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
`;

export const pulse = keyframes`
  0% {
    transform: scale(1,1);
  }
  50% {
    transform: scale(1.15, 1.15);
  }
  100% {
    transform: scale(1, 1);
  }
`;

export const expandOut = keyframes`
  0% {
    transform: scale(1, 1);
    opacity: 1;
  }

  100% {
    transform: scale(5, 5);
    opacity: 0;
  }
`;

export const slideInRight = keyframes`
  0% {
    transform: translateX(20px);
    opacity: 0;
  }

  100% {
    transform: translateX(0);
    opacity: 1;
  }
`;
