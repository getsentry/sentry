import type {Theme} from '@emotion/react';
import {css, keyframes} from '@emotion/react';

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
  background: var(--pulsingIndicatorBg, ${p.theme.colors.pink400});
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
    border: 4px solid var(--pulsingIndicatorRing, ${p.theme.colors.pink200});
    transform-origin: center;
    animation: ${pulse} 3s ease-out infinite;
    pointer-events: none;
  }
`;

export default pulsingIndicatorStyles;
