import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {t} from 'sentry/locale';

export function PrIterationDropdownMenu({
  isDisabled,
  onChange,
}: {
  isDisabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <DropdownMenu
      isDisabled={isDisabled}
      size="xs"
      triggerLabel={t('Auto-Iterate on PRs')}
      items={[
        {key: 'on', label: t('On'), onAction: () => onChange(true)},
        {key: 'off', label: t('Off'), onAction: () => onChange(false)},
      ]}
    />
  );
}
