import styled from '@emotion/styled';

import space from 'app/styles/space';

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 0.5fr 2fr 1fr 1fr 1fr minmax(92px, 0.5fr);
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const TitleAndSparkLine = styled('div')`
  display: flex;
  grid-gap: ${space(1)};
  grid-template-columns: auto 120px;
  align-items: center;
  padding-right: ${space(2)};
  overflow: hidden;
`;

export {TableLayout, TitleAndSparkLine};
