import {useCallback} from 'react';
import {css, keyframes, useTheme} from '@emotion/react';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';

import {defined} from 'sentry/utils/defined';

import {
  ActivityLineContent,
  ActivityLineList,
  ActivityLineRow,
} from './activityLineItem/layout';

interface TimelineItemProps {
  headline: React.ReactNode;
  marker: React.ReactNode;
  children?: React.ReactNode;
  highlightedActivityId?: string;
  variant?: 'default' | 'card';
}

const highlightPulse = keyframes`
  45% {
    opacity: 0.18;
  }
`;

function Item({
  marker,
  headline,
  children,
  highlightedActivityId,
  variant = 'default',
}: TimelineItemProps) {
  const theme = useTheme();
  const scrollToHighlight = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element || !highlightedActivityId) {
        return;
      }

      const frame = requestAnimationFrame(() =>
        element.scrollIntoView({block: 'start', inline: 'nearest'})
      );
      return () => cancelAnimationFrame(frame);
    },
    [highlightedActivityId]
  );
  const highlightStyle = highlightedActivityId
    ? css`
        isolation: isolate;
        scroll-margin-top: ${theme.space.md};

        &::after {
          content: '';
          position: absolute;
          z-index: -1;
          inset: ${variant === 'card' ? '0' : `-${theme.space['2xs']} -${theme.space.sm}`};
          border-radius: ${theme.radius.md};
          background-color: ${theme.tokens.background.accent.vibrant};
          opacity: 0.08;
          pointer-events: none;

          @media (prefers-reduced-motion: no-preference) {
            animation: ${highlightPulse} 1s ease-in-out;
          }
        }
      `
    : undefined;
  const highlightProps = highlightedActivityId
    ? {ref: scrollToHighlight, 'aria-current': 'location' as const}
    : undefined;

  if (variant === 'card') {
    return (
      <ActivityLineRow>
        <Stack
          {...highlightProps}
          css={highlightStyle}
          column="1 / -1"
          position="relative"
          left={`-${theme.space.lg}`}
          width={`calc(100% + ${theme.space.lg})`}
          padding="lg"
          gap="lg"
          border="primary"
          radius="md"
          background="primary"
        >
          <Grid columns="24px minmax(0, 1fr)" align="center" gap="sm">
            {marker}
            {headline}
          </Grid>
          {children}
        </Stack>
      </ActivityLineRow>
    );
  }

  return (
    <ActivityLineRow {...highlightProps} css={highlightStyle}>
      <Container column={1} row={1}>
        {marker}
      </Container>
      <Flex column={2} row={1} minWidth={0} minHeight="22px" align="center">
        {headline}
      </Flex>
      {defined(children) && <ActivityLineContent>{children}</ActivityLineContent>}
    </ActivityLineRow>
  );
}

export const Timeline = {Container: ActivityLineList, Item};
