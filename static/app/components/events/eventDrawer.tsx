import styled from '@emotion/styled';

import {
  BreadcrumbList,
  type BreadcrumbCurrentItem,
  type BreadcrumbListProps,
} from '@sentry/scraps/breadcrumbList';
import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {InputGroup} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/eventTitle';
import {PRIMARY_HEADER_HEIGHT} from 'sentry/views/navigation/constants';

export const Header = styled('h3')`
  display: block;
  min-width: 0;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0;
`;

export const SearchInput = InputGroup.Input;

interface DrawerBreadcrumbsProps {
  current: BreadcrumbCurrentItem;
  items?: BreadcrumbListProps['items'];
}

/**
 * Breadcrumbs for drawers and panels. The page already owns the `<h1>` in the
 * TopBar, so the current location renders without a heading. Unlike the TopBar
 * trail, these are rendered in a `<nav>` landmark.
 */
export function DrawerBreadcrumbs({items = [], current}: DrawerBreadcrumbsProps) {
  return (
    <Flex as="nav" aria-label={t('Breadcrumbs')} align="center" flex="1" minWidth="0">
      {items.length === 0 ? (
        <BreadcrumbList.Current item={current} />
      ) : (
        <Flex
          containerType="inline-size"
          width="100%"
          align="center"
          gap="sm"
          minWidth="0"
        >
          <Flex align="center" gap="sm" minWidth="0" flex="0 1 auto">
            <BreadcrumbList items={items} />
          </Flex>
          <Flex align="center" gap="sm" minWidth="0" flexGrow={1}>
            <BreadcrumbList.Current item={current} />
          </Flex>
        </Flex>
      )}
    </Flex>
  );
}

// oxlint-disable-next-line @sentry/scraps/prefer-primitives
export const EventDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: max-content max-content auto;

  /* Matches the TopBar height */
  --event-drawer-header-height: ${PRIMARY_HEADER_HEIGHT}px;
  --event-navigator-box-shadow: none;
  --event-navigator-border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

export const EventDrawerHeader = styled(DrawerHeader)`
  position: unset;
  /* Height priority: container variable → DrawerHeader height prop → default */
  height: var(--event-drawer-header-height, var(--drawer-header-height, auto));
  max-height: var(
    --event-drawer-header-height,
    var(--drawer-header-height, ${MIN_NAV_HEIGHT}px)
  );
  min-height: var(
    --event-drawer-header-height,
    var(--drawer-header-height, ${MIN_NAV_HEIGHT}px)
  );
  align-items: center;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

export const EventNavigator = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: ${p => p.theme.space.md};
  padding: 0 24px;
  background: ${p => p.theme.tokens.background.primary};
  z-index: 2; /* Just above EventStickyControls */
  height: var(--event-drawer-header-height, auto);
  min-height: var(--event-drawer-header-height, ${MIN_NAV_HEIGHT}px);
  border-bottom: var(--event-navigator-border-bottom, 0);
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: var(
    --event-navigator-box-shadow,
    ${p => `${p.theme.tokens.border.primary} 0 1px`}
  );
`;

export const EventDrawerBody = styled(DrawerBody)`
  overflow: auto;
  overscroll-behavior: contain;
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-direction: column;
`;
