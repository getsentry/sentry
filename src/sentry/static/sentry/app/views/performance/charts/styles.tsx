import styled from '@emotion/styled';

import space from 'app/styles/space';

export const HeaderTitle = styled('span')`
  font-size: ${p => p.theme.fontSizeLarge};
  padding: 0 ${space(1)};
`;

export const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

export const ChartsContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column-gap: ${space(1)};
  padding: ${space(2)} ${space(1.5)};
`;

export const ChartContainer = styled('div')`
  flex-grow: 1;
`;

export const ChartControls = styled('div')`
  display: flex;
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.borderLight};
`;
