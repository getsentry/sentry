import type {ComponentPropsWithoutRef} from 'react';
import styled from '@emotion/styled';

import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, type FlexProps} from '@sentry/scraps/layout';

import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
} from 'sentry/views/navigation/constants';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export const Header = styled('h3')`
  display: block;
  font-size: ${p => p.theme.font.size.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0;
`;

export const SearchInput = InputGroup.Input;

export const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

export function CrumbContainer(props: FlexProps<'div'>) {
  return <Flex align="center" gap="md" {...props} />;
}

export const ShortId = styled('div')`
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.md};
  line-height: 1;
`;

const EventDrawerContainerRoot = styled('div')<{hasPageFrameFeature: boolean}>`
  height: 100%;
  display: grid;
  grid-template-rows: max-content max-content auto;

  ${p =>
    p.hasPageFrameFeature &&
    `
      /* Responsive height that matches the TopBar (48px mobile, 53px desktop) */
      --event-drawer-header-height: ${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px;
      --event-navigator-box-shadow: none;
      --event-navigator-border-bottom: 1px solid ${p.theme.tokens.border.primary};

      @media (min-width: ${p.theme.breakpoints.md}) {
        --event-drawer-header-height: ${PRIMARY_HEADER_HEIGHT}px;
      }
    `}
`;

export function EventDrawerContainer(props: ComponentPropsWithoutRef<'div'>) {
  const hasPageFrameFeature = useHasPageFrameFeature();

  return (
    <EventDrawerContainerRoot {...props} hasPageFrameFeature={hasPageFrameFeature} />
  );
}

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

export const EventStickyControls = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  position: sticky;
  top: -${p => p.theme.space.xl};
  margin-block: -${p => p.theme.space.xl};
  padding-block: ${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.primary};
  z-index: 1; /* Just below EventNavigator */

  /* Make this full-width inside DrawerBody */
  margin-inline: -24px;
  padding-inline: 24px;
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
