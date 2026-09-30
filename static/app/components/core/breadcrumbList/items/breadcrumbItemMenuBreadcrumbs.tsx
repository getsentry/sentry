import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {IconEllipsis} from 'sentry/icons';

interface BreadcrumbMenuLinkItem {
  key: string;
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
  const {t} = useTranslation();

  return (
    <Flex as="span" align="center" height="32px" flexShrink={0}>
      <DropdownMenu
        size="sm"
        items={items}
        trigger={(triggerProps, isOpen) => (
          <OverlayTrigger.IconButton
            {...triggerProps}
            aria-label={t('More breadcrumbs')}
            aria-expanded={isOpen}
            size="zero"
            variant="transparent"
            icon={<IconEllipsis size="xs" aria-hidden />}
          />
        )}
      />
    </Flex>
  );
}
