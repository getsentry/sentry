import {keyframes} from '@emotion/core';

import theme from 'app/utils/theme';

export const growIn = keyframes`
  0% {
    opacity: 0;
    transform: scale(0.75);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

export const growDown = (height: string) => keyframes`
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

export const pulse = (size: number) => keyframes`
  0% {
    transform: scale(1,1);
  }
  50% {
    transform: scale(${size}, ${size});
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

export const highlight = (color: string) => keyframes`
  0%,
  100% {
    background: rgba(255, 255, 255, 0);
  }

  25% {
    background: ${color};
  }
`;

// TODO(ts): priority should be pulled from `keyof typeof theme.alert`
export const alertHighlight = (priority: string) => keyframes`
  0%,
  100% {
    background: rgba(255, 255, 255, 0);
    border-color: transparent;
  }

  25% {
    background: ${theme.alert[priority].backgroundLight};
    border-color: ${theme.alert[priority].border};
  }
`;
