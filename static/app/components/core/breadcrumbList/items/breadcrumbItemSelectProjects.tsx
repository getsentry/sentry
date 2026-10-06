import {CompactSelect} from '@sentry/scraps/compactSelect';
import type {SelectKey, SingleSelectProps} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {IconChevron} from 'sentry/icons';

import {BreadcrumbItemLink} from './breadcrumbItemLink';

export type BreadcrumbItemSelectProjectsProps<Value extends SelectKey = string> = Pick<
  Extract<SingleSelectProps<Value>, {clearable?: false}>,
  'options' | 'value' | 'onChange' | 'onOpenChange' | 'search' | 'loading'
> & {
  /** Keeps the current label visible when search results omit the selected option. */
  label?: string;
  leadingGraphic?: React.ReactNode;
  /** Destination for the parent crumb, beside its selector. */
  to?: LinkProps['to'];
};

export function BreadcrumbItemSelectProjects<Value extends SelectKey = string>({
  options,
  value,
  onChange,
  label,
  leadingGraphic,
  to,
  ...props
}: BreadcrumbItemSelectProjectsProps<Value>) {
  const {t} = useTranslation();
  const selected = options
    .flatMap(option => ('options' in option ? option.options : [option]))
    .find(option => option.value === value);
  const selectedLabel =
    label ?? (typeof selected?.label === 'string' ? selected.label : String(value));

  return (
    <Flex as="span" align="center" gap="xs" flexShrink={0}>
      {to && (
        <BreadcrumbItemLink
          label={selectedLabel}
          leadingGraphic={leadingGraphic}
          to={to}
        />
      )}
      <CompactSelect
        {...props}
        options={options}
        value={value}
        onChange={onChange}
        size="sm"
        trigger={triggerProps =>
          to ? (
            <OverlayTrigger.IconButton
              {...triggerProps}
              aria-label={t('Switch %s', selectedLabel)}
              size="zero"
              variant="transparent"
              icon={<IconChevron size="xs" direction="down" />}
            />
          ) : (
            <OverlayTrigger.Button
              {...triggerProps}
              aria-label={t('Selected Project: %s', selectedLabel)}
            />
          )
        }
      />
    </Flex>
  );
}
