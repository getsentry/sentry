import type {ComponentProps, ReactNode} from 'react';

import {DropdownButton} from 'sentry/components/dropdownButton';

export function CompactSelect({
  options,
  value,
  size,
}: {
  options: Array<{label: ReactNode; value: unknown}>;
  size?: ComponentProps<typeof DropdownButton>['size'];
  value?: unknown;
}) {
  return (
    <DropdownButton size={size}>
      {options.find(opt => opt.value === value)?.label}
    </DropdownButton>
  );
}
