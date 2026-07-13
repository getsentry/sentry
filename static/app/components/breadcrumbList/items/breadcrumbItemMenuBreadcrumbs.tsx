import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';

import {DropdownButton} from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';

interface BreadcrumbMenuLinkItem {
  label: string;
  to: LinkProps['to'];
}

interface BreadcrumbItemMenuBreadcrumbsProps {
  /** The collapsed parent crumbs to show in the dropdown. */
  items: BreadcrumbMenuLinkItem[];
}

/**
 * Internal component — rendered automatically by BreadcrumbList when the container
 * is too narrow to show all parent crumbs. Collapses them into an ellipsis button.
 */
export function BreadcrumbItemMenuBreadcrumbs({
  items,
}: BreadcrumbItemMenuBreadcrumbsProps) {
  const menuItems = items.map((item, index) => ({
    // Include the index so two crumbs pointing at the same destination don't
    // collide on key — DropdownMenu requires unique keys. The list is static and
    // never reordered, so the index is a stable identifier.
    key: `${index}-${typeof item.to === 'string' ? item.to : JSON.stringify(item.to)}`,
    label: item.label,
    to: item.to,
  }));

  return (
    <Flex as="span" align="center" height="32px" flexShrink={0}>
      <DropdownMenu
        size="sm"
        items={menuItems}
        trigger={(triggerProps, isOpen) => (
          <DropdownButton
            {...triggerProps}
            aria-label={t('More breadcrumbs')}
            aria-expanded={isOpen}
            size="zero"
            variant="transparent"
            showChevron={false}
            icon={<IconEllipsis size="xs" aria-hidden />}
          />
        )}
      />
    </Flex>
  );
}
