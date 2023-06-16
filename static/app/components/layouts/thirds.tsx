import styled from '@emotion/styled';

import NavTabs from 'sentry/components/navTabs';
import {space} from 'sentry/styles/space';

/**
 * Main container for a page.
 */
export const Page = styled('main')<{withPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  flex: 1;
  ${p => p.withPadding && `padding: ${space(3)} ${space(4)}`};
`;

/**
 * Header container for header content and header actions.
 *
 * Uses a horizontal layout in wide viewports to put space between
 * the headings and the actions container. In narrow viewports these elements
 * are stacked vertically.
 *
 * Use `noActionWrap` to disable wrapping if there are minimal actions.
 */
export const Header = styled('header')<{noActionWrap?: boolean}>`
  display: grid;
  grid-template-columns: ${p =>
    !p.noActionWrap ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto'};

  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  background-color: transparent;
  border-bottom: 1px solid ${p => p.theme.border};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)} ${space(4)} 0 ${space(4)};
    grid-template-columns: minmax(0, 1fr) auto;
  }
`;

/**
 * Use HeaderContent to create horizontal regions in the header
 * that contain a heading/breadcrumbs and a button group.
 */
export const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: normal;
  margin-bottom: ${space(2)};
  overflow: hidden;
  max-width: 100%;

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: ${space(1)};
  }
`;

/**
 * Container for action buttons and secondary information that
 * flows on the top right of the header.
 */
export const HeaderActions = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: normal;
  min-width: max-content;
  margin-top: ${space(0.25)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    width: max-content;
    margin-bottom: ${space(2)};
  }
`;

/**
 * Heading title
 *
 * Includes flex gap for additional items placed with the text (such as feature
 * badges or ID badges)
 */
export const Title = styled('h1')<{withMargins?: boolean}>`
  ${p => p.theme.overflowEllipsis};
  ${p => p.theme.text.pageTitle};
  color: ${p => p.theme.headingColor};
  margin: 0;
  margin-bottom: ${p => p.withMargins && space(3)};
  margin-top: ${p => p.withMargins && space(1)};
  line-height: 40px;

  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

/**
 * Styled Nav Tabs for use inside a Layout.Header component
 */
export const HeaderNavTabs = styled(NavTabs)`
  margin: 0;
  border-bottom: 0 !important;

  & > li {
    margin-right: ${space(3)};
  }
  & > li > a {
    display: flex;
    align-items: center;
    height: 1.25rem;
    padding: ${space(1)} 0;
    margin-bottom: 4px;
    box-sizing: content-box;
  }
  & > li.active > a {
    margin-bottom: 0;
  }
`;

/**
 * Base container for 66/33 containers.
 */
export const Body = styled('div')<{noRowGap?: boolean}>`
  padding: ${space(2)};
  margin: 0;
  background-color: ${p => p.theme.background};
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${p =>
      !p.noRowGap ? `${space(3)} ${space(4)}` : `${space(2)} ${space(4)}`};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    display: grid;
    grid-template-columns: minmax(100px, auto) 325px;
    align-content: start;
    gap: ${p => (!p.noRowGap ? `${space(3)}` : `0 ${space(3)}`)};
  }
`;

/**
 * Containers for left column of the 66/33 layout.
 */
export const Main = styled('section')<{fullWidth?: boolean}>`
  grid-column: ${p => (p.fullWidth ? '1/3' : '1/2')};
  max-width: 100%;
`;

/**
 * Container for the right column the 66/33 layout
 */
export const Side = styled('aside')`
  grid-column: 2/3;
`;
