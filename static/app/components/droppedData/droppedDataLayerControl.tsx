import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger, type TriggerProps} from '@sentry/scraps/overlayTrigger';

import {IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';

const DROPPED_DATA_LAYER = 'dropped-data';

function layersTrigger(triggerProps: TriggerProps) {
  return (
    <OverlayTrigger.Button
      {...triggerProps}
      aria-label={t('Chart layers')}
      icon={<IconStack />}
      variant="transparent"
      showChevron={false}
      size="xs"
      tooltipProps={{title: t('Show or hide additional layers on this chart')}}
    />
  );
}

function includesDroppedDataLayer(selected: Array<SelectOption<string>>): boolean {
  return selected.some(option => option.value === DROPPED_DATA_LAYER);
}

interface DroppedDataLayerControlProps {
  onChange: (showDroppedData: boolean) => void;
  showDroppedData: boolean;
}

// TODO: refactor this component to also handle feature flags and releases
export function DroppedDataLayerControl({
  showDroppedData,
  onChange,
}: DroppedDataLayerControlProps) {
  function handleChange(selected: Array<SelectOption<string>>) {
    onChange(includesDroppedDataLayer(selected));
  }

  return (
    <CompactSelect
      multiple
      value={showDroppedData ? [DROPPED_DATA_LAYER] : []}
      options={[{value: DROPPED_DATA_LAYER, label: t('Dropped Data')}]}
      menuTitle={t('Layers')}
      trigger={layersTrigger}
      onChange={handleChange}
    />
  );
}
