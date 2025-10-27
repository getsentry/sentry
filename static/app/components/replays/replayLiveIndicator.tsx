import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import type {ReplayRecord} from 'sentry/views/replays/types';

export const LIVE_TOOLTIP_MESSAGE = t('This replay is in progress.');

export function getReplayExpiresAtMs(startedAt: ReplayRecord['started_at']): number {
  const ONE_HOUR_MS = 3_600_000;
  return startedAt ? startedAt.getTime() + ONE_HOUR_MS : 0;
}

export function getLiveDurationMs(finishedAt: ReplayRecord['finished_at']): number {
  if (!finishedAt) {
    return 0;
  }
  const FIVE_MINUTE_MS = 300_000;
  return Math.max(finishedAt.getTime() + FIVE_MINUTE_MS - Date.now(), 0);
}

const pulse = keyframes`
  0% {
    transform: scale(0.1);
    opacity: 1
  }

  40%, 100% {
    transform: scale(1);
    opacity: 0;
  }
`;

export const LiveIndicator = styled('div')`
  background: ${p => p.theme.successText};
  height: 8px;
  width: 8px;
  position: relative;
  border-radius: 50%;
  margin-left: ${p => p.theme.space.sm};
  margin-right: ${p => p.theme.space.sm};

  @media (prefers-reduced-motion: reduce) {
    &:before {
      display: none;
    }
  }

  &:before {
    content: '';
    animation: ${pulse} 3s ease-out infinite;
    border: 6px solid ${p => p.theme.successText};
    position: absolute;
    border-radius: 50%;
    height: 20px;
    width: 20px;
    top: -6px;
    left: -6px;
  }
`;
