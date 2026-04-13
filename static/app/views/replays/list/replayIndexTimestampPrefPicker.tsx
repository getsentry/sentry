import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {REPLAY_TIMESTAMP_OPTIONS} from 'sentry/components/replays/preferences/replayPreferences';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function ReplayIndexTimestampPrefPicker() {
  const [prefs, setPrefs] = useReplayPrefs();
  const hasPageFrameFeature = useHasPageFrameFeature();

  return (
    <CompactSelect
      options={[
        {
          key: t('Timestamps'),
          label: t('Timestamps'),
          options: REPLAY_TIMESTAMP_OPTIONS.map(option => ({
            label: toTitleCase(option),
            value: option,
            key: option,
          })),
        },
      ]}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          icon={<IconSettings />}
          size={hasPageFrameFeature ? 'sm' : undefined}
          aria-label={t('Configure timestamp settings')}
        />
      )}
      value={prefs.timestampType}
      onChange={opt => setPrefs({timestampType: opt.value})}
    />
  );
}
