import React from 'react';
import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import ShortId from 'app/components/shortId';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

/**
 * Styled components used to render discover result sets.
 */
export const Container = styled('div')`
  ${overflowEllipsis};
`;

export const VersionContainer = styled('div')`
  ${overflowEllipsis};
  max-width: 100%;
  width: auto;
  display: inline-block;
`;

export const NumberContainer = styled('div')`
  text-align: right;
  ${overflowEllipsis};
`;

export const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray500};
  ${overflowEllipsis};
`;

export const OverflowLink = styled(Link)`
  ${overflowEllipsis};
`;

/* Layout containers for discover and performance views */
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

export const Main = styled('div')`
  grid-column: 1/2;
  max-width: 100%;
  overflow: hidden;
`;

export const Side = styled('div')`
  grid-column: 2/3;
`;

export const HeaderBox = styled(ContentBox)`
  border-bottom: 1px solid ${p => p.theme.borderDark};
  grid-row-gap: ${space(1)};
  background-color: transparent;
  flex-grow: 0;
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

export const StyledShortId = styled(ShortId)`
  justify-content: flex-start;
`;

export const BarContainer = styled('div')`
  max-width: 80px;
  margin-left: auto;
`;

export const EventId = ({value}: {value: string}) => {
  const shortId = value.substring(0, 8);
  return <React.Fragment>{shortId}</React.Fragment>;
};
