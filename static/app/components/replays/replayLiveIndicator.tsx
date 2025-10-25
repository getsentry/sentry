import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {ReplayRecord} from 'sentry/views/replays/types';

export function liveDuration(finishedAt: ReplayRecord['finished_at']) {
  if (!finishedAt) {
    return 0;
  }
  const FIVE_MINUTE_MS = 300_000;
  return finishedAt.getTime() + FIVE_MINUTE_MS - Date.now();
}

const TOOLTIP_MESSAGE = 'This replay is still in progress.';

export default function ReplayLiveIndicator() {
  return (
    <Tooltip title={TOOLTIP_MESSAGE} underlineColor="success" showUnderline>
      <Flex align="center">
        <Text bold variant="success" data-test-id="live-badge">
          {t('LIVE')}
        </Text>
        <LiveIndicator />
      </Flex>
    </Tooltip>
  );
}

export function LiveIndicatorWithToolTip() {
  return (
    <Tooltip title={TOOLTIP_MESSAGE}>
      <LiveIndicator />
    </Tooltip>
  );
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

const LiveIndicator = styled('div')`
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
