import {css, keyframes, Theme} from '@emotion/react';

const pulse = keyframes`
  0% {
    transform: scale(0.1);
    opacity: 1
  }

  40%, 100% {
    transform: scale(0.8);
    opacity: 0;
  }
`;

const pulsingIndicatorStyles = (p: {theme: Theme}) => css`
  height: 8px;
  width: 8px;
  border-radius: 50%;
  background: ${p.theme.pink300};
  position: relative;

  &:before {
    content: '';
    display: block;
    position: absolute;
    height: 100px;
    width: 100px;
    border-radius: 50%;
    top: -46px;
    left: -46px;
    border: 4px solid ${p.theme.pink200};
    transform-origin: center;
    animation: ${pulse} 3s ease-out infinite;
  }
`;

export default pulsingIndicatorStyles;
