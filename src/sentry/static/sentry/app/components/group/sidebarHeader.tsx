import styled from '@emotion/styled';

import space from 'app/styles/space';

const SidebarHeader = styled('h5')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};

  &:after {
    flex: 1;
    display: block;
    content: '';
    border-top: 1px solid ${p => p.theme.innerBorder};
    margin-left: ${space(1)};
  }
`;

export default SidebarHeader;
