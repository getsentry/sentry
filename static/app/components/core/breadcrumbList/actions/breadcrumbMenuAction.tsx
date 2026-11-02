import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

export interface BreadcrumbMenuActionProps {
  /** Menu entries rendered inside the dropdown. */
  items: MenuItemProps[];
  /** Icon rendered inside the icon-only trigger button. */
  triggerIcon: NonNullable<React.ReactNode>;
  /** Accessible name for the trigger button. */
  triggerLabel: string;
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
        <OverlayTrigger.IconButton
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
