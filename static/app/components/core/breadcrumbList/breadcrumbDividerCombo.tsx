import type {Responsive} from '@sentry/scraps/layout';
import {Container, Flex} from '@sentry/scraps/layout';

import {IconSlashForward} from 'sentry/icons';

interface BreadcrumbDividerComboProps {
  children: React.ReactNode;
  /** Controls visibility — use responsive values for container-query toggling. */
  display?: Responsive<'flex' | 'none'>;
}

/**
 * Internal wrapper that pairs a breadcrumb item with a trailing slash divider.
 * Not exported — only BreadcrumbList should use this to ensure consistent structure.
 *
 * The visibility toggle lives on a `Container`, not the inner `Flex`: `Flex`
 * defaults every unspecified breakpoint/axis slot to `flex`, which emits an
 * always-matching `@media (min-width: 0px)` rule that shadows the container
 * query and pins the element visible. `Container` skips unspecified slots, so
 * the `@container` query actually drives the collapse.
 */
export function BreadcrumbDividerCombo({children, display}: BreadcrumbDividerComboProps) {
  return (
    // flexShrink={999} makes parent crumbs give up width first, so the current
    // page (a much lower shrink) truncates last. These wrappers keep the default
    // min-width:auto (no min-width:0) so they can't collapse past the crumb's own
    // floor — set on the item's outer Flex — down to 0 when the row is very tight.
    <Container as="li" display={display ?? 'flex'} flexShrink={999}>
      <Flex align="center" gap="xs">
        {children}
        <Flex as="span" align="center" justify="center" flexShrink={0} aria-hidden>
          <IconSlashForward size="md" variant="muted" aria-hidden />
        </Flex>
      </Flex>
    </Container>
  );
}
