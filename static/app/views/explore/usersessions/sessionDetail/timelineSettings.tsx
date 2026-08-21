import {useCallback, useMemo} from 'react';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

const COMPRESS_IDLE = 'compress-idle';
const HIDE_EMPTY_LANES = 'hide-empty-lanes';

interface Props {
  /** Whether inactive stretches of the session are collapsed on the axis. */
  compressIdle: boolean;
  /** Whether lanes the session has nothing in are left out of the chart. */
  hideEmptyLanes: boolean;
  onToggleCompressIdle: () => void;
  onToggleHideEmptyLanes: () => void;
}

/**
 * How the timeline is drawn, rather than what it is drawn from — which is why it
 * is a menu of its own and not another control in the filter row below.
 *
 * Both settings are held in component state and deliberately not persisted: they
 * are still being shaped, and a preference that survives a reload is one the
 * person has to find again to undo.
 */
export function TimelineSettings({
  compressIdle,
  hideEmptyLanes,
  onToggleCompressIdle,
  onToggleHideEmptyLanes,
}: Props) {
  const options: Array<SelectOption<string>> = [
    {
      label: t('Hide inactivity'),
      value: COMPRESS_IDLE,
      details: t('Collapses long stretches where nothing happened.'),
    },
    {
      label: t('Hide empty categories'),
      value: HIDE_EMPTY_LANES,
      details: t('Hides swim lanes for telemetry types this session has none of.'),
    },
  ];

  const values = useMemo(() => {
    const selected: string[] = [];
    if (compressIdle) {
      selected.push(COMPRESS_IDLE);
    }
    if (hideEmptyLanes) {
      selected.push(HIDE_EMPTY_LANES);
    }
    return selected;
  }, [compressIdle, hideEmptyLanes]);

  // Each option owns one boolean, so the change is read as a diff against what is
  // currently on rather than by working out which entry the menu added or removed.
  const onChange = useCallback(
    (selected: Array<SelectOption<string>>) => {
      const next = new Set(selected.map(option => option.value));
      if (next.has(COMPRESS_IDLE) !== compressIdle) {
        onToggleCompressIdle();
      }
      if (next.has(HIDE_EMPTY_LANES) !== hideEmptyLanes) {
        onToggleHideEmptyLanes();
      }
    },
    [compressIdle, hideEmptyLanes, onToggleCompressIdle, onToggleHideEmptyLanes]
  );

  return (
    <CompactSelect
      multiple
      value={values}
      options={options}
      onChange={onChange}
      menuWidth={300}
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          size="xs"
          aria-label={t('Timeline settings')}
          icon={<IconSettings />}
        />
      )}
    />
  );
}
