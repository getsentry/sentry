import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SingleSelectProps} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {BreadcrumbLeadingSlot} from './breadcrumbLeadingSlot';

export type BreadcrumbItemSelectProjectsProps<Value extends SelectKey = string> = Pick<
  Extract<SingleSelectProps<Value>, {clearable?: false}>,
  'options' | 'value' | 'onChange' | 'onOpenChange' | 'search' | 'loading'
> & {
  /** Explicit title, including while options are loading or filtered. */
  label?: string;
  leadingGraphic?: React.ReactNode;
};

export function BreadcrumbItemSelectProjects<Value extends SelectKey = string>({
  options,
  value,
  onChange,
  label,
  leadingGraphic,
  ...props
}: BreadcrumbItemSelectProjectsProps<Value>) {
  const {t} = useTranslation();

  // Prefer the selected option's human-readable label; fall back to the raw value
  // when the label isn't a plain string (it may be a React node).
  const selected = options
    .flatMap(option => ('options' in option ? option.options : [option]))
    .find(option => option.value === value);
  const selectedLabel =
    typeof selected?.label === 'string' ? selected.label : String(value);

  return (
    <Flex as="span" align="center" gap="sm" flexShrink={0}>
      {leadingGraphic && <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>}
      <CompactSelect
        {...props}
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
            aria-label={label ?? t('Selected Project: %s', selectedLabel)}
          >
            {label ?? triggerProps.children}
          </OverlayTrigger.Button>
        )}
      />
    </Flex>
  );
}
