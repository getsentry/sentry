import type {useSeparator} from '@react-aria/separator';

import {Stack} from '@sentry/scraps/layout';
import {SectionSeparator} from '@sentry/scraps/menu';

/** Height (px) of `DropdownMenuSeparator`, also used to estimate unmounted rows. */
export const SEPARATOR_HEIGHT = 8;

export interface DropdownMenuSeparatorProps {
  separatorProps: ReturnType<typeof useSeparator>['separatorProps'];
}

export function DropdownMenuSeparator({separatorProps}: DropdownMenuSeparatorProps) {
  return (
    <Stack
      justify="center"
      height={`${SEPARATOR_HEIGHT}px`}
      padding="0 lg 0 xl"
      {...separatorProps}
      role="presentation"
    >
      <SectionSeparator />
    </Stack>
  );
}
