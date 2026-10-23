import {IconStack} from '@sentry/icons/stack';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger, type TriggerProps} from '@sentry/scraps/overlayTrigger';

import {droppedDataLabel} from 'sentry/components/droppedData/outcomes';
import {t} from 'sentry/locale';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';

const DROPPED_DATA_LAYER = 'dropped-data';

function layersTrigger(triggerProps: TriggerProps, hasSelectedLayer: boolean) {
  return (
    <OverlayTrigger.Button
      {...triggerProps}
      aria-label={t('Chart layers')}
      icon={<IconStack />}
      variant="transparent"
      showChevron={false}
      size="xs"
      tooltipProps={{title: t('Show or hide additional layers on this chart')}}
    >
      {hasSelectedLayer ? triggerProps.children : t('Layers')}
    </OverlayTrigger.Button>
  );
}

function includesDroppedDataLayer(selected: Array<SelectOption<string>>): boolean {
  return selected.some(option => option.value === DROPPED_DATA_LAYER);
}

interface DroppedDataLayerControlProps {
  dataset: DiscoverDatasets;
  onChange: (showDroppedData: boolean) => void;
  showDroppedData: boolean;
}

// TODO: refactor this component to also handle feature flags and releases
export function DroppedDataLayerControl({
  dataset,
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
      options={[{value: DROPPED_DATA_LAYER, label: droppedDataLabel(dataset)}]}
      menuTitle={t('Layers')}
      trigger={triggerProps => layersTrigger(triggerProps, showDroppedData)}
      onChange={handleChange}
    />
  );
}
