import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';

export interface BreadcrumbItemSelectProjectsProps<Value extends SelectKey = string> {
  onChange: (value: SelectOption<Value>) => void;
  options: Array<SelectOption<Value>>;
  value: Value;
}

export function BreadcrumbItemSelectProjects<Value extends SelectKey = string>({
  options,
  value,
  onChange,
}: BreadcrumbItemSelectProjectsProps<Value>) {
  // Prefer the selected option's human-readable label; fall back to the raw value
  // when the label isn't a plain string (it may be a React node).
  const selected = options.find(option => option.value === value);
  const selectedLabel =
    typeof selected?.label === 'string' ? selected.label : String(value);

  return (
    <Flex as="span" align="center" flexShrink={0}>
      <CompactSelect
        options={options}
        value={value}
        onChange={onChange}
        size="sm"
        // Give the trigger a descriptive accessible name. CompactSelect doesn't
        // forward a top-level aria-label to its trigger, so render the default
        // button (OverlayTrigger.Button) and label it. Without this the trigger's
        // only accessible name is the selected value, with no hint of its purpose.
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            aria-label={t('Selected Project: %s', selectedLabel)}
          />
        )}
      />
    </Flex>
  );
}
