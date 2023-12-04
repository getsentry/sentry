import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/profiling/flex';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {showPlayerTime} from 'sentry/components/replays/utils';
import Well from 'sentry/components/well';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

interface Props {
  initialOffsetMs: number;
  refetch: () => void;
}

export default function AccessibilityRefetchBanner({initialOffsetMs, refetch}: Props) {
  const {currentTime, replay, setCurrentTime, isPlaying, togglePlayPause} =
    useReplayContext();

  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;
  const [lastOffsetMs, setLastOffsetMs] = useState(initialOffsetMs);

  const handleClickRefetch = useCallback(() => {
    togglePlayPause(false);
    setLastOffsetMs(currentTime);
    refetch();
  }, [currentTime, refetch, togglePlayPause]);

  const handleClickTimestamp = useCallback(() => {
    setCurrentTime(lastOffsetMs);
  }, [setCurrentTime, lastOffsetMs]);

  const now = showPlayerTime(startTimestampMs + currentTime, startTimestampMs, false);

  return (
    <StyledWell>
      <Flex
        gap={space(1)}
        justify="space-between"
        align="center"
        wrap="nowrap"
        style={{overflow: 'auto'}}
      >
        <Flex gap={space(1)} wrap="nowrap" style={{whiteSpace: 'nowrap'}}>
          {tct('Results as of [lastRuntime]', {
            lastRuntime: (
              <StyledTimestampButton
                aria-label={t('See in replay')}
                onClick={handleClickTimestamp}
                startTimestampMs={startTimestampMs}
                timestampMs={startTimestampMs + lastOffsetMs}
              />
            ),
          })}
        </Flex>
        <Button
          size="xs"
          priority="primary"
          onClick={handleClickRefetch}
          disabled={currentTime === lastOffsetMs}
        >
          {isPlaying
            ? tct('Pause and run validation for [now]', {now})
            : tct('Run validation for [now]', {now})}
        </Button>
      </Flex>
    </StyledWell>
  );
}

const StyledWell = styled(Well)`
  margin-bottom: 0;
  border-radius: ${p => p.theme.borderRadiusTop};
`;

const StyledTimestampButton = styled(TimestampButton)`
  align-self: center;
  align-items: center;
`;
