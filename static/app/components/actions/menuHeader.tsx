import styled from '@emotion/styled';

import MenuItem from 'sentry/components/menuItem';

const MenuHeader = styled(MenuItem)`
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.gray400};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding: ${p => p.theme.space(1)};
`;

MenuHeader.defaultProps = {
  header: true,
};

export default MenuHeader;
