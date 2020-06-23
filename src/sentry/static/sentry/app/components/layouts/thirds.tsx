import styled from '@emotion/styled';

import space from 'app/styles/space';

/**
 * Base container for 66/33 containers.
 */
export const Body = styled('div')`
  padding: ${space(2)} ${space(4)};
  margin: 0;
  background-color: ${p => p.theme.white};
  flex-grow: 1;

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
  overflow: auto;
`;

export const HeaderActions = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: normal;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    width: max-content;
    margin-bottom: ${space(2)};
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
  flex-grow: 0;
  justify-content: space-between;
  padding: ${space(2)} ${space(4)} 0 ${space(4)};
  margin: 0;

  background-color: transparent;
  border-bottom: 1px solid ${p => p.theme.borderDark};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    flex-direction: column;
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
