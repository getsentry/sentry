import {Menu} from '@sentry/scraps/menu';

/**
 * Provides the default footer layout for a `DropdownMenu`.
 */
export function DropdownMenuFooter(props: React.ComponentProps<typeof Menu.Footer>) {
  return <Menu.Footer {...props} />;
}
