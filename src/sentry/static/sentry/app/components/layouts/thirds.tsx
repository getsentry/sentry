import styled from '@emotion/styled';

import space from 'app/styles/space';

export const ContentBox = styled('div')`
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
 * Header container for when there are no breadcrumbs/toolbars
 */
export const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray700};
  height: 40px;
  margin-bottom: ${space(1)};
`;

export const HeaderTopControls = styled('div')`
  display: flex;
  justify-self: end;
  grid-row: 1/2;
  grid-column: 2/3;
`;

export const HeaderBottomControls = styled('div')`
  display: flex;
  justify-self: end;
  justify-content: flex-end;
  grid-row: 2/3;
  grid-column: 2/3;
`;

/**
 * Header container for breadcrumbs and toolbars.
 */
export const HeaderWithControls = styled(ContentBox)`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  grid-row-gap: ${space(1)};
  background-color: transparent;
  flex-grow: 0;
`;

export const Main = styled('div')`
  grid-column: 1/2;
  max-width: 100%;
  overflow: hidden;
`;

export const Side = styled('div')`
  grid-column: 2/3;
`;
