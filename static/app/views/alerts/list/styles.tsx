import styled from '@emotion/styled';

import space from 'app/styles/space';

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 3fr 2fr 2fr 0.5fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

export {TableLayout};
