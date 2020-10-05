import styled from '@emotion/styled';

import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import NavTabs from 'app/components/navTabs';

/**
 * Base container for 66/33 containers.
 */
export const Body = styled('div')`
  padding: ${space(2)};
  margin: 0;
  background-color: ${p => p.theme.white};
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(2)} ${space(4)};
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-columns: 66% auto;
    align-content: start;
    grid-gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: minmax(100px, auto) 325px;
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

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
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

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    width: max-content;
    margin-bottom: ${space(2)};
  }
`;

/**
 * Heading container that includes margins.
 */
export const Title = styled('h2')`
  font-size: ${p => p.theme.headerFontSize};
  font-weight: normal;
  line-height: 1.2;
  color: ${p => p.theme.gray700};
  margin-top: ${space(3)};
  /* TODO(bootstrap) Remove important when bootstrap headings are removed */
  margin-bottom: 0 !important;
  min-height: 30px;
  align-self: center;
  ${overflowEllipsis};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    margin-top: ${space(1)};
  }
`;

/**
 * Header container for header content and header actions.
 *
 * Uses a horizontal layout in wide viewports to put space between
 * the headings and the actions container. In narrow viewports these elements
 * are stacked vertically.
 */
export const Header = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  flex-grow: 0;
  justify-content: space-between;
  padding: ${space(2)} ${space(4)} 0 ${space(4)};
  margin: 0;

  background-color: transparent;
  border-bottom: 1px solid ${p => p.theme.borderDark};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(2)} ${space(2)} 0 ${space(2)};
  }

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    flex-direction: column;
  }
`;

/**
 * Styled Nav Tabs for use inside a Layout.Header component
 */
export const HeaderNavTabs = styled(NavTabs)`
  margin: 0;
  border-bottom: 0 !important;
  li {
    margin-right: ${space(0.5)};
  }
  li > a {
    padding: ${space(1)} ${space(2)};
  }
`;

/**
 * Containers for two column 66/33 layout.
 */
export const Main = styled('section')<{fullWidth?: boolean}>`
  grid-column: ${p => (p.fullWidth ? '1/3' : '1/2')};
  max-width: 100%;
`;
export const Side = styled('aside')`
  grid-column: 2/3;
`;
