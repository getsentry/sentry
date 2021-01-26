import React from 'react';
import styled from '@emotion/styled';

import ActionLink from 'app/components/actions/actionLink';
import MenuItem from 'app/components/menuItem';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

function MenuItemActionLinkBase({
  className,
  ...props
}: React.ComponentProps<typeof ActionLink>) {
  return (
    <MenuItem noAnchor disabled={props.disabled} className={className}>
      <StyledActionLink {...props} />
    </MenuItem>
  );
}
const StyledActionLink = styled(ActionLink)`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis}
  &:hover {
    color: ${p => p.theme.textColor};
  }

  .dropdown-menu > li > &,
  .dropdown-menu > span > li > & {
    padding: ${space(1)};

    &.disabled:hover {
      background: ${p => p.theme.white};
      color: #7a8188;
    }
  }
`;

const MenuItemActionLink = styled(MenuItemActionLinkBase)`
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding: 0;

  &:last-child {
    border-bottom: none;
  }
`;

export default MenuItemActionLink;
