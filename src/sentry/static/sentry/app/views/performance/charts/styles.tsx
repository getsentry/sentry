import styled from '@emotion/styled';

import space from 'app/styles/space';

export const HeaderTitle = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  padding: 0 ${space(1)};
`;

export const ChartsContainer = styled('div')`
  padding: ${space(2)} ${space(1.5)};
`;

export const ChartsGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column-gap: ${space(1)};
`;

export const ChartContainer = styled('div')`
  flex-grow: 1;
`;
