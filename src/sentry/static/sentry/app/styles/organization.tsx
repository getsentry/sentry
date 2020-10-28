// Shared styles for the new org level pages with global project/env/time selection
import styled from '@emotion/styled';

import space from 'app/styles/space';

export const PageContent = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${space(2)} ${space(4)} ${space(3)};
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

export const PageHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(2)};
`;

export const HeaderTitle = styled('h4')`
  flex: 1;
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray700};
  margin: 0;
`;
