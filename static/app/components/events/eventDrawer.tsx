import type {ComponentPropsWithoutRef} from 'react';
import styled from '@emotion/styled';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/eventTitle';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
} from 'sentry/views/navigation/constants';

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

const StyledNavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

/**
 * Standalone breadcrumbs for drawers/panels. Unlike breadcrumbs rendered into
 * the top bar title (which live inside the page `<h1>`), these are not inside a
 * heading, so they render as a proper `<nav>` landmark.
 */
export function NavigationCrumbs(
  props: ComponentPropsWithoutRef<typeof NavigationBreadcrumbs>
) {
  return <StyledNavigationCrumbs as="nav" {...props} />;
}

export function CrumbContainer(props: FlexProps) {
  return <Flex align="center" gap="md" {...props} />;
}

export const ShortId = styled('div')`
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1;
`;

export const EventDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: max-content max-content auto;

  /* Responsive height that matches the TopBar (48px mobile, 53px desktop) */
  --event-drawer-header-height: ${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px;
  --event-navigator-box-shadow: none;
  --event-navigator-border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    --event-drawer-header-height: ${PRIMARY_HEADER_HEIGHT}px;
  }
`;

export const EventDrawerHeader = styled(DrawerHeader)`
  position: unset;
  /* Height priority: container variable (responsive) → DrawerHeader height prop → default */
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
  /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
  box-shadow: var(
    --event-navigator-box-shadow,
    ${p => `${p.theme.tokens.border.primary} 0 1px`}
  );
`;

export const EventDrawerBody = styled(DrawerBody)`
  overflow: auto;
  overscroll-behavior: contain;
  /* Move the scrollbar to the left edge */
  scroll-margin: 0 ${p => p.theme.space.xl};
  display: flex;
  gap: ${p => p.theme.space.xl};
  flex-direction: column;
  direction: rtl;
  * {
    direction: ltr;
  }
`;
