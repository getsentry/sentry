import styled from '@emotion/styled';

import space from 'app/styles/space';

const TableLayout = styled('div')<{status: 'open' | 'closed'}>`
  display: grid;
  grid-template-columns: ${p =>
    p.status === 'open' ? '4fr 1fr 2fr' : '3fr 2fr 2fr 1fr 2fr'};
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const TitleAndSparkLine = styled('div')<{status: 'open' | 'closed'}>`
  display: ${p => (p.status === 'open' ? 'grid' : 'flex')};
  grid-gap: ${space(1)};
  grid-template-columns: auto 120px;
  align-items: center;
  padding-right: ${space(2)};
  overflow: hidden;
`;

export {TableLayout, TitleAndSparkLine};
