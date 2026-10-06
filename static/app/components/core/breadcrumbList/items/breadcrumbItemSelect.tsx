import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SingleSelectProps} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {IconChevron} from 'sentry/icons';

import {BreadcrumbLeadingSlot} from './breadcrumbLeadingSlot';

export type BreadcrumbItemSelectProps<Value extends SelectKey = string> = Pick<
  Extract<SingleSelectProps<Value>, {clearable?: false}>,
  'options' | 'value' | 'onChange' | 'onOpenChange' | 'search' | 'loading'
> & {
  /** Keeps the current label visible when search results omit the selected option. */
  label?: string;
  leadingGraphic?: React.ReactNode;
};

export function BreadcrumbItemSelect<Value extends SelectKey = string>({
  options,
  value,
  onChange,
  label,
  leadingGraphic,
  ...props
}: BreadcrumbItemSelectProps<Value>) {
  const {t} = useTranslation();
  const selected = options
    .flatMap(option => ('options' in option ? option.options : [option]))
    .find(option => option.value === value);
  const selectedLabel =
    label ?? (typeof selected?.label === 'string' ? selected.label : String(value));

  return (
    <Flex as="span" align="center" gap="xs" flexShrink={0}>
      <Flex as="span" align="center" gap="sm" height="32px" minWidth="32px">
        {leadingGraphic && (
          <BreadcrumbLeadingSlot>{leadingGraphic}</BreadcrumbLeadingSlot>
        )}
        <Container minWidth={0}>
          <Text ellipsis variant="muted">
            {selectedLabel}
          </Text>
        </Container>
      </Flex>
      <CompactSelect
        {...props}
        options={options}
        value={value}
        onChange={onChange}
        size="sm"
        trigger={triggerProps => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            aria-label={t('Switch %s', selectedLabel)}
            size="zero"
            variant="transparent"
            icon={<IconChevron size="xs" direction="down" />}
          />
        )}
      />
    </Flex>
  );
}
