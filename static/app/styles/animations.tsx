import {keyframes} from '@emotion/react';

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

export const makeShake = (distance = 3) => keyframes`
${new Array(50)
  .fill(0)
  .map(
    (_, i) => `${i * 2}% {
  transform: translate(${Math.round(Math.random() * distance)}px, ${Math.round(
    Math.random() * distance
  )}px);
}`
  )
  .join('\n')}
`;

export const makeOpacityJitter = () => keyframes`
${new Array(50)
  .fill(0)
  .map(
    (_, i) => `${i * 2}% {
  opacity: ${Math.round(Math.random() * 10) / 10};
}`
  )
  .join('\n')}
`;
