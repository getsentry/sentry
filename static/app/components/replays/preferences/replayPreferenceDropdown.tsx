import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {CompositeSelect} from 'sentry/components/core/compactSelect/composite';
import {Flex} from 'sentry/components/core/layout';
import {REPLAY_TIMESTAMP_OPTIONS} from 'sentry/components/replays/preferences/replayPreferences';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import formatDuration from 'sentry/utils/duration/formatDuration';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

export default function ReplayPreferenceDropdown({
  speedOptions,
  hideFastForward = false,
  isLoading,
}: {
  speedOptions: number[];
  hideFastForward?: boolean;
  isLoading?: boolean;
}) {
  const [prefs, setPrefs] = useReplayPrefs();
  const replay = useReplayReader();
  const {isFetching} = useReplayContext();

  const SKIP_OPTION_VALUE = 'skip';

  // Calculate adjusted duration for each speed, rounded up to the nearest second.
  // Returns in seconds
  const calculateAdjustedDuration = (originalDurationMs: number, speed: number) => {
    if (speed === 1) {
      return originalDurationMs / 1000;
    }

    return Math.ceil(originalDurationMs / speed / 1000);
  };

  // Check if we should show duration (data is loaded and duration is available)
  const shouldShowDuration =
    !isLoading && !isFetching && replay && replay.getDurationMs() > 0;

  return (
    <CompositeSelect
      size="sm"
      disabled={isLoading}
      trigger={triggerProps => (
        <SelectTrigger.IconButton
          {...triggerProps}
          title={t('Settings')}
          aria-label={t('Settings')}
          icon={<IconSettings />}
        />
      )}
    >
      <CompositeSelect.Region
        label={t('Playback Speed')}
        value={prefs.playbackSpeed}
        onChange={opt => setPrefs({playbackSpeed: opt.value})}
        options={speedOptions.map(option => {
          const baseLabel = `${option}x`;

          if (shouldShowDuration) {
            const adjustedDurationMs = calculateAdjustedDuration(
              replay.getDurationMs(),
              option
            );
            const durationDisplay = formatDuration({
              duration: [adjustedDurationMs, 'sec'],
              precision: 'sec',
              style: 'h:mm:ss',
            });
            return {
              label: (
                <Flex justify="between">
                  <span>{baseLabel}</span>
                  <DurationDisplay>{durationDisplay}</DurationDisplay>
                </Flex>
              ),
              textValue: baseLabel,
              value: option,
            };
          }

          return {
            label: baseLabel,
            value: option,
          };
        })}
      />
      <CompositeSelect.Region
        label={t('Timestamps')}
        value={prefs.timestampType}
        onChange={opt => setPrefs({timestampType: opt.value})}
        options={REPLAY_TIMESTAMP_OPTIONS.map(option => ({
          label: `${toTitleCase(option)}`,
          value: option,
        }))}
      />
      {hideFastForward ? null : (
        <CompositeSelect.Region
          aria-label={t('Fast-Forward Inactivity')}
          multiple
          value={prefs.isSkippingInactive ? [SKIP_OPTION_VALUE] : []}
          onChange={opts => setPrefs({isSkippingInactive: opts.length > 0})}
          options={[
            {
              label: t('Fast-forward inactivity'),
              value: SKIP_OPTION_VALUE,
            },
          ]}
        />
      )}
    </CompositeSelect>
  );
}

const DurationDisplay = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
`;
