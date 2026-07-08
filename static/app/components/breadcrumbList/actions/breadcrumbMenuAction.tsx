import {Button} from '@sentry/scraps/button';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';

export interface BreadcrumbMenuActionProps {
  /** Menu entries rendered inside the dropdown. */
  items: MenuItemProps[];
  /** Accessible name for the trigger button. */
  triggerLabel: string;
  /** Icon rendered inside the icon-only trigger button. */
  triggerIcon?: React.ReactNode;
}

/**
 * A dropdown-menu trailing action for the page-title crumb — e.g. a page-level
 * actions (…) menu. Renders an icon-only transparent trigger that opens a
 * `DropdownMenu` of `items`.
 */
export function BreadcrumbMenuAction({
  items,
  triggerLabel,
  triggerIcon,
}: BreadcrumbMenuActionProps) {
  return (
    <DropdownMenu
      items={items}
      trigger={(triggerProps, isOpen) => (
        <Button
          {...triggerProps}
          size="zero"
          variant="transparent"
          icon={triggerIcon}
          aria-label={triggerLabel}
          aria-expanded={isOpen}
        />
      )}
    />
  );
}
