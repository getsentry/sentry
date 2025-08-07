import {css, type Theme} from '@emotion/react';

import type {TickStyle} from 'sentry/components/checkInTimeline/types';

export function getTickStyle<Status extends string>(
  statusStyles: TickStyle<Status>,
  status: Status,
  theme: Theme
) {
  const style = statusStyles(theme)[status];

  if (style.hatchTick === undefined) {
    return css`
      background: ${style.tickColor};
    `;
  }

  return css`
    border: 1px solid ${style.tickColor};
    background-size: 3px 3px;
    opacity: 0.5;
    background-image:
      linear-gradient(
        -45deg,
        ${style.hatchTick} 25%,
        transparent 25%,
        transparent 50%,
        ${style.hatchTick} 50%,
        ${style.hatchTick} 75%,
        transparent 75%,
        transparent
      ),
      linear-gradient(
        45deg,
        ${style.hatchTick} 25%,
        transparent 25%,
        transparent 50%,
        ${style.hatchTick} 50%,
        ${style.hatchTick} 75%,
        transparent 75%,
        transparent
      );
  `;
}
