import React from 'react';
import styled from '@emotion/styled';

import MenuItem from 'app/components/menuItem';
import space from 'app/styles/space';

type Props = {
  children: React.ReactNode;
  className?: string;
};

function MenuHeaderBase({children, className}: Props) {
  return (
    <MenuItem header className={className}>
      {children}
    </MenuItem>
  );
}

const MenuHeader = styled(MenuHeaderBase)`
  text-transform: uppercase;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding-bottom: ${space(0.5)};
`;

export default MenuHeader;
