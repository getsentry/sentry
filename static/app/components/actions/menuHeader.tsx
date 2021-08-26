import styled from '@emotion/styled';

import MenuItem from 'app/components/menuItem';
import space from 'app/styles/space';

const MenuHeader = styled(MenuItem)`
  text-transform: uppercase;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding: ${space(1)};
`;

MenuHeader.defaultProps = {
  header: true,
};

export default MenuHeader;
