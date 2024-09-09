import {Button} from 'sentry/components/button';
import {CompositeSelect} from 'sentry/components/compactSelect/composite';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useReplayPrefs} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

export default function ReplayPreferenceDropdown({
  speedOptions,
  hideFastForward = false,
}: {
  speedOptions: number[];
  hideFastForward?: boolean;
}) {
  const [prefs, setPrefs] = useReplayPrefs();

  const SKIP_OPTION_VALUE = 'skip';

  return (
    <CompositeSelect
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size="sm"
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
        options={speedOptions.map(option => ({
          label: `${option}x`,
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
