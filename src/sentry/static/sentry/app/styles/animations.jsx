import {keyframes} from 'react-emotion';

export const growIn = keyframes`
  0% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
`;

export const growDown = height => keyframes`
  0% {
    height: 0;
  }
  100% {
    height: ${height};
  }
`;

export const fadeIn = keyframes`
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
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

export const slideInLeft = keyframes`
  0% {
    transform: translateX(-20px);
    opacity: 0;
  }

  100% {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideInUp = keyframes`
  0% {
    transform: translateY(10px);
    opacity: 0;
  }

  100% {
    transform: translateY(0);
    opacity: 1;
  }
`;

export const highlight = color => keyframes`
  0%,
  100% {
    background: rgba(255, 255, 255, 0);
  }

  25% {
    background: ${color};
  }
`;
