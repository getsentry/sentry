import type {Responsive} from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout';

import {IconSlashForward} from 'sentry/icons';

interface BreadcrumbDividerComboProps {
  children: React.ReactNode;
  /** Controls visibility — use responsive values for container-query toggling. */
  display?: Responsive<'flex' | 'none'>;
}

/**
 * Internal wrapper that pairs a breadcrumb item with a trailing slash divider.
 * Not exported — only BreadcrumbList should use this to ensure consistent structure.
 */
export function BreadcrumbDividerCombo({children, display}: BreadcrumbDividerComboProps) {
  return (
    <Flex
      as="li"
      align="center"
      gap="xs"
      overflow="hidden"
      flexShrink={0}
      display={display}
    >
      {children}
      <Flex as="span" align="center" justify="center" flexShrink={0}>
        <IconSlashForward size="xs" variant="muted" />
      </Flex>
    </Flex>
  );
}
