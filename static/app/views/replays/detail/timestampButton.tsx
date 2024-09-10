import type {MouseEvent} from 'react';
import styled from '@emotion/styled';

import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import formatDuration from 'sentry/utils/duration/formatDuration';

type Props = {
  startTimestampMs: number;
  timestampMs: string | number | Date;
  className?: string;
  onClick?: (event: MouseEvent) => void;
  precision?: 'sec' | 'ms';
};

export default function TimestampButton({
  className,
  precision = 'sec',
  onClick,
  startTimestampMs,
  timestampMs,
}: Props) {
  const {timestampType} = useReplayContext();
  const timestampMsAsTime = new Date(timestampMs).getTime();
  return (
    <Tooltip
      title={
        <div>
          <div>
            {t(
              'Date: %s',
              getFormattedDate(
                timestampMsAsTime,
                `${getFormat({year: true, seconds: true, timeZone: true})}`,
                {
                  local: true,
                }
              )
            )}
          </div>
          <div>
            {t(
              'Time within replay: %s',
              formatDuration({
                duration: [Math.abs(timestampMsAsTime - startTimestampMs), 'ms'],
                precision: 'ms',
                style: 'hh:mm:ss.sss',
              })
            )}
          </div>
        </div>
      }
      skipWrapper
    >
      <StyledButton
        as={onClick ? 'button' : 'span'}
        onClick={onClick}
        className={className}
      >
        <IconPlay size="xs" />
        {timestampType === 'absolute' ? (
          <DateTime timeOnly seconds date={timestampMsAsTime} />
        ) : (
          <Duration
            duration={[Math.abs(timestampMsAsTime - startTimestampMs), 'ms']}
            precision={precision}
          />
        )}
      </StyledButton>
    </Tooltip>
  );
}

const StyledButton = styled('button')`
  background: transparent;
  border: none;
  color: inherit;
  font-variant-numeric: tabular-nums;
  line-height: 1.2em;

  display: flex;
  align-items: flex-start;
  align-self: baseline;
  gap: ${space(0.25)};
  padding: 0;
  height: 100%;
`;
