import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import Placeholder from 'sentry/components/placeholder';
import {useRotatingMessage} from 'sentry/views/replays/detail/ai/useRotatingMessage';
import {REPLAY_SUMMARY_PROCESSING_MESSAGES} from 'sentry/views/replays/detail/ai/utils';

export function ReplaySummaryLoading() {
  const message = useRotatingMessage(REPLAY_SUMMARY_PROCESSING_MESSAGES);

  return (
    <Stack align="center" padding="lg" gap="md">
      <Placeholder height="100px">
        <ShimmerText size="md">{message}</ShimmerText>
      </Placeholder>
    </Stack>
  );
}

const textSweep = keyframes`
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
`;

// Uses content tokens in background intentionally — background-clip: text
// makes the gradient act as a text color sweep, not a surface background.
/* eslint-disable @sentry/scraps/use-semantic-token */
const ShimmerText = styled(Text)`
  background: linear-gradient(
    90deg,
    ${p => p.theme.tokens.content.secondary} 0%,
    ${p => p.theme.tokens.content.secondary} 35%,
    ${p => p.theme.tokens.content.primary} 50%,
    ${p => p.theme.tokens.content.secondary} 65%,
    ${p => p.theme.tokens.content.secondary} 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: ${textSweep} 3s ease-in-out infinite;
  padding: 0 ${p => p.theme.space.xl};
  text-align: center;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    background: none;
    -webkit-text-fill-color: unset;
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
/* eslint-enable @sentry/scraps/use-semantic-token */
