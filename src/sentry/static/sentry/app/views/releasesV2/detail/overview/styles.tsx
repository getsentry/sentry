import styled from '@emotion/styled';

import space from 'app/styles/space';

export const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
  padding-right: ${space(1)};
  line-height: 1.2;
`;

export const Wrapper = styled('div')`
  margin-bottom: ${space(4)};
`;
