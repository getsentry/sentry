import {css, type Theme} from '@emotion/react';

import type {TickStyle} from '../types';

export function getTickStyle<Status extends string>(
  statusStyles: Record<Status, TickStyle>,
  status: Status,
  theme: Theme
) {
  const style = statusStyles[status];

  if (style.hatchTick === undefined) {
    return css`
      background: ${theme[style.tickColor]};
    `;
  }

  return css`
    border: 1px solid ${theme[style.tickColor]};
    background-size: 3px 3px;
    opacity: 0.5;
    background-image: linear-gradient(
        -45deg,
        ${theme[style.hatchTick]} 25%,
        transparent 25%,
        transparent 50%,
        ${theme[style.hatchTick]} 50%,
        ${theme[style.hatchTick]} 75%,
        transparent 75%,
        transparent
      ),
      linear-gradient(
        45deg,
        ${theme[style.hatchTick]} 25%,
        transparent 25%,
        transparent 50%,
        ${theme[style.hatchTick]} 50%,
        ${theme[style.hatchTick]} 75%,
        transparent 75%,
        transparent
      );
  `;
}
