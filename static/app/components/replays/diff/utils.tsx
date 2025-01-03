import styled from '@emotion/styled';

import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export const DiffHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.2;
  justify-content: space-between;

  & > *:first-child {
    color: ${p => p.theme.red300};
  }

  & > *:last-child {
    color: ${p => p.theme.green300};
  }
`;

interface BeforeAfterProps {
  offset: number;
  startTimestampMs: number;
  children?: React.ReactNode;
}

export function Before({children, offset, startTimestampMs}: BeforeAfterProps) {
  return (
    <Label>
      <Tooltip
        title={
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
        {t('Before')}
      </Tooltip>
      {children}
    </Label>
  );
}

export function After({children, offset, startTimestampMs}: BeforeAfterProps) {
  return (
    <Label>
      <Tooltip
        title={
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
        {t('After')}
      </Tooltip>
      {children}
    </Label>
  );
}

const LeftAligned = styled('div')`
  text-align: left;
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
`;

const Label = styled('div')`
  display: flex;
  align-items: center;
  font-weight: bold;
`;
