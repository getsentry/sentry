import styled from '@emotion/styled';

import space from 'app/styles/space';

export const HeaderTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray3};

  padding: ${space(2)};
`;
