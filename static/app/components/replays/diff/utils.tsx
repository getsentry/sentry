import styled from '@emotion/styled';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface BeforeAfterProps {
  offset: number;
  startTimestampMs: number;
  children?: React.ReactNode;
}

export function Before({children, offset, startTimestampMs}: BeforeAfterProps) {
  return (
    <ContentSliderDiff.BeforeLabel
      help={
        <LeftAligned>
          {t('The server-rendered page')}
          <div>
            <ReplayTooltipTime
              timestampMs={startTimestampMs + offset}
              startTimestampMs={startTimestampMs}
            />
          </div>
        </LeftAligned>
      }
    >
      {children}
    </ContentSliderDiff.BeforeLabel>
  );
}

export function After({children, offset, startTimestampMs}: BeforeAfterProps) {
  return (
    <ContentSliderDiff.AfterLabel
      help={
        <LeftAligned>
          {t('After React re-rendered the page, and reported a hydration error')}
          <div>
            <ReplayTooltipTime
              timestampMs={startTimestampMs + offset}
              startTimestampMs={startTimestampMs}
            />
          </div>
        </LeftAligned>
      }
    >
      {children}
    </ContentSliderDiff.AfterLabel>
  );
}

const LeftAligned = styled('div')`
  text-align: left;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;
