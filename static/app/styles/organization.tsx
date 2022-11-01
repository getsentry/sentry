// Shared styles for the new org level pages with global project/env/time selection
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

export const PageContent = styled('main')`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${space(3)} ${space(4)};
`;

export const PageHeader = styled('header')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(2)};
  min-height: 32px;
`;

export const HeaderTitle = styled('h4')`
  ${p => p.theme.text.pageTitle};
  color: ${p => p.theme.headingColor};
  flex: 1;
  margin: 0;
`;
