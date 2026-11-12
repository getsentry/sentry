import {Stack} from '@sentry/scraps/layout';

interface BreadcrumbLeadingSlotProps {
  children: React.ReactNode;
}

/**
 * The fixed 16×16 leading slot shared by every breadcrumb item. Owns the sizing
 * and centering so items can accept any decorative node (a `ProjectsBadge`,
 * a project/user avatar, a Sentry icon) without each caller re-wrapping it.
 *
 * Renders `aria-hidden`: the graphic is decorative and its meaning is carried by
 * the crumb label beside it.
 */
export function BreadcrumbLeadingSlot({children}: BreadcrumbLeadingSlotProps) {
  return (
    <Stack
      flexShrink={0}
      justify="center"
      align="center"
      width="16px"
      height="16px"
      aria-hidden="true"
    >
      {children}
    </Stack>
  );
}
