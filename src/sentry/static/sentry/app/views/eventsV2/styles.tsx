import styled from '@emotion/styled';

import DateTime from 'app/components/dateTime';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

export const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

export const Container = styled('div')`
  ${overflowEllipsis};
`;

export const NumberContainer = styled('div')`
  text-align: right;
  ${overflowEllipsis};
`;

export const StyledDateTime = styled(DateTime)`
  color: ${p => p.theme.gray2};
  ${overflowEllipsis};
`;

export const OverflowLink = styled(Link)`
  ${overflowEllipsis};
`;

export const ChartControls = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

export const HeaderBox = styled('div')`
  padding: ${space(2)} ${space(4)};
  background-color: ${p => p.theme.white};
  border-bottom: 1px solid ${p => p.theme.borderDark};
  grid-row-gap: ${space(2)};
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: grid;
    grid-template-rows: 1fr 30px;
    grid-template-columns: 65% auto;
    grid-column-gap: ${space(3)};
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: auto 325px;
  }
`;

export const HeaderControls = styled('div')`
  display: flex;
  justify-self: end;
  grid-row: 1/2;
  grid-column: 2/3;
`;

export const InlineContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
`;
