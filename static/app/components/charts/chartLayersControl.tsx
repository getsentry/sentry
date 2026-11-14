import {IconStack} from '@sentry/icons/stack';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {OverlayTrigger, type TriggerProps} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';

export interface ChartLayer {
  label: string;
  selected: boolean;
  value: string;
  disabled?: boolean;
  tooltip?: string;
}

export interface ChartLayersControlProps {
  layers: ChartLayer[];
  onChange: (value: string, selected: boolean) => void;
  triggerLabel?: 'selected' | 'icon';
}

function layersTrigger(
  triggerProps: TriggerProps,
  triggerLabel: 'selected' | 'icon',
  hasSelectedLayer: boolean
) {
  const sharedProps = {
    'aria-label': t('Chart layers'),
    icon: <IconStack />,
    variant: 'transparent',
    size: 'xs',
    tooltipProps: {title: t('Show or hide additional layers on this chart')},
  } as const;

  if (triggerLabel === 'icon') {
    return <OverlayTrigger.IconButton {...triggerProps} {...sharedProps} />;
  }

  return (
    <OverlayTrigger.Button {...triggerProps} {...sharedProps} showChevron={false}>
      {hasSelectedLayer ? triggerProps.children : t('Layers')}
    </OverlayTrigger.Button>
  );
}

export function ChartLayersControl({
  layers,
  onChange,
  triggerLabel = 'selected',
}: ChartLayersControlProps) {
  const selectedValues = layers.filter(layer => layer.selected).map(layer => layer.value);

  function handleChange(selected: Array<SelectOption<string>>) {
    const nextValues = new Set(selected.map(option => option.value));
    const changedLayer = layers.find(
      layer => layer.selected !== nextValues.has(layer.value)
    );

    if (changedLayer) {
      onChange(changedLayer.value, !changedLayer.selected);
    }
  }

  return (
    <CompactSelect
      multiple
      value={selectedValues}
      options={layers.map(layer => ({
        value: layer.value,
        label: layer.label,
        disabled: layer.disabled,
        tooltip: layer.tooltip,
      }))}
      menuTitle={t('Layers')}
      trigger={triggerProps =>
        layersTrigger(triggerProps, triggerLabel, selectedValues.length > 0)
      }
      onChange={handleChange}
    />
  );
}
