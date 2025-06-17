import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface BeforeAfterProps {
  offset: number;
  startTimestampMs: number;
  children?: ReactNode;
}

function ReplayDiffTooltip({
  children,
  offset,
  startTimestampMs,
}: {
  children: ReactNode;
  offset: number;
  startTimestampMs: number;
}) {
  return (
    <QuestionTooltip
      size="xs"
      title={
        <LeftAligned>
          {children}
          <div>
            <ReplayTooltipTime
              timestampMs={startTimestampMs + offset}
              startTimestampMs={startTimestampMs}
            />
          </div>
        </LeftAligned>
      }
    />
  );
}

export function Before({children, offset, startTimestampMs}: BeforeAfterProps) {
  return (
    <Flex gap={space(0.5)} align="center">
      {t('Server')}
      <ReplayDiffTooltip offset={offset} startTimestampMs={startTimestampMs}>
        {t('The server-rendered page')}
      </ReplayDiffTooltip>
      {children}
    </Flex>
  );
}

export function After({children, offset, startTimestampMs}: BeforeAfterProps) {
  return (
    <Flex gap={space(0.5)} align="center">
      {t('Client')}
      <ReplayDiffTooltip offset={offset} startTimestampMs={startTimestampMs}>
        {t('After React re-rendered the page, and reported a hydration error')}
      </ReplayDiffTooltip>
      {children}
    </Flex>
  );
}

const LeftAligned = styled('div')`
  text-align: left;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;
