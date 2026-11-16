import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

type Props = {
  label: string;
  onSelect: (key: string) => void;
  options: Record<string, Omit<SelectOption<string>, 'value'>>;
  selected: string;
  className?: string;
};

export function ReleasesDropdown({
  className,
  label: prefix,
  options,
  selected,
  onSelect,
}: Props) {
  const mappedOptions = Object.entries(options).map(
    ([key, {label, tooltip, disabled}]) => ({
      value: key,
      label,
      tooltip,
      disabled,
    })
  );

  return (
    <CompactSelect
      className={className}
      options={mappedOptions}
      onChange={opt => onSelect(opt.value)}
      value={selected}
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          prefix={prefix}
          style={{width: '100%'}}
        />
      )}
    />
  );
}
