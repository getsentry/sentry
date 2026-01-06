import styled from '@emotion/styled';

import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {space} from 'sentry/styles/space';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventTitle';

export const Header = styled('h3')`
  display: block;
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin: 0;
`;

export const SearchInput = InputGroup.Input;

export const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

export const CrumbContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

export const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1;
`;

export const EventDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: max-content max-content auto;
`;

export const EventDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

export const EventNavigator = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: ${space(1)};
  padding: ${space(0.75)} 24px;
  background: ${p => p.theme.tokens.background.primary};
  z-index: 2; /* Just above EventStickyControls */
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.tokens.border.primary} 0 1px;
`;

export const EventStickyControls = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  position: sticky;
  top: -${space(2)};
  margin-block: -${space(2)};
  padding-block: ${space(2)};
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
  scroll-margin: 0 ${space(2)};
  display: flex;
  gap: ${space(2)};
  flex-direction: column;
  direction: rtl;
  * {
    direction: ltr;
  }
`;
