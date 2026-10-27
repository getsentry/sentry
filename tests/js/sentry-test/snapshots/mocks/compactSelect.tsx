import type {ComponentProps, ReactNode} from 'react';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

export function CompactSelect({
  options,
  value,
  size,
}: {
  options: Array<{label: ReactNode; value: unknown}>;
  size?: ComponentProps<typeof OverlayTrigger.Button>['size'];
  value?: unknown;
}) {
  return (
    <OverlayTrigger.Button size={size}>
      {options.find(opt => opt.value === value)?.label ?? ''}
    </OverlayTrigger.Button>
  );
}
