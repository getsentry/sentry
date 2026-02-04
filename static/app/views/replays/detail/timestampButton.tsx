import type {MouseEvent} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {DateTime} from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration/duration';
import ReplayTooltipTime from 'sentry/components/replays/replayTooltipTime';
import {IconPlay} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  startTimestampMs: number;
  timestampMs: number;
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
  const [prefs] = useReplayPrefs();
  const timestampType = prefs.timestampType;

  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();

  return (
    <Tooltip
      title={
        <div>
          <ReplayTooltipTime
            timestampMs={timestampMs}
            startTimestampMs={startTimestampMs}
          />
        </div>
      }
      skipWrapper
    >
      <StyledButton
        as={onClick ? 'button' : 'span'}
        onClick={event => {
          onClick?.(event);
          trackAnalytics('replay.details-timestamp-button-clicked', {
            organization,
            area: analyticsArea,
          });
        }}
        className={className}
      >
        <IconPlay size="xs" />
        {timestampType === 'absolute' ? (
          <DateTime timeOnly seconds date={timestampMs} />
        ) : (
          <Duration
            duration={[Math.abs(timestampMs - startTimestampMs), 'ms']}
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
