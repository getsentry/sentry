import {css, keyframes} from '@emotion/core';

const topLeftIn = keyframes`
    0% {
        transform:translate(-5%,-5%)
    }
    to {
        transform:translate(0%,0%)
    }
`;

const bottomRightIn = keyframes`
  0% {
    transform: translate(5%, 5%);
  }
  to {
    transform: translate(0%, 0%);
  }
`;

const animateTopLeftIn = css`
  animation: 0.5s ${topLeftIn} cubic-bezier(0.68, -0.55, 0.265, 1.55);
  transform-origin: center center;
`;

const animateBottomRightIn = css`
  animation: 0.5s ${bottomRightIn} cubic-bezier(0.68, -0.55, 0.265, 1.55);
`;

export {animateBottomRightIn, animateTopLeftIn};
