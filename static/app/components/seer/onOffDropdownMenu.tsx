import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {t} from 'sentry/locale';

export function OnOffDropdownMenu({
  isDisabled,
  onChange,
  triggerLabel,
}: {
  isDisabled: boolean;
  onChange: (value: boolean) => void;
  triggerLabel: string;
}) {
  return (
    <DropdownMenu
      isDisabled={isDisabled}
      size="xs"
      triggerLabel={triggerLabel}
      items={[
        {key: 'on', label: t('On'), onAction: () => onChange(true)},
        {key: 'off', label: t('Off'), onAction: () => onChange(false)},
      ]}
    />
  );
}
