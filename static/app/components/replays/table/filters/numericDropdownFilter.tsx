import {IconEllipsis} from '@sentry/icons/ellipsis';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {t} from 'sentry/locale';

import {ActionMenuTrigger, useGenerateAction} from './utils';

const DEFAULT_NUMERIC_DROPDOWN_FORMATTER = (val: number) => val.toString();

export function NumericDropdownFilter({
  type,
  val,
  formatter = DEFAULT_NUMERIC_DROPDOWN_FORMATTER,
}: {
  type: string;
  val: number;
  formatter?: (val: number) => string;
}) {
  const generateAction = useGenerateAction();

  return (
    <DropdownMenu
      items={[
        {
          key: 'add',
          label: 'Add to filter',
          onAction: generateAction({
            key: type,
            value: formatter(val),
          }),
        },
        {
          key: 'greater',
          label: 'Show values greater than',
          onAction: generateAction({
            key: type,
            value: '>' + formatter(val),
          }),
        },
        {
          key: 'less',
          label: 'Show values less than',
          onAction: generateAction({
            key: type,
            value: '<' + formatter(val),
          }),
        },
        {
          key: 'exclude',
          label: t('Exclude from filter'),
          onAction: generateAction({
            key: '!' + type,
            value: formatter(val),
          }),
        },
      ]}
      usePortal
      size="xs"
      offset={4}
      position="bottom"
      preventOverflowOptions={{padding: 4}}
      flipOptions={{
        fallbackPlacements: ['top', 'right-start', 'right-end', 'left-start', 'left-end'],
      }}
      trigger={triggerProps => (
        <ActionMenuTrigger
          {...triggerProps}
          aria-label={t('Actions')}
          data-visible-on-hover
          icon={<IconEllipsis size="xs" />}
          size="zero"
        />
      )}
    />
  );
}
