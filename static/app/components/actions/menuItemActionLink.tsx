import * as React from 'react';
import styled from '@emotion/styled';

import ActionLink from 'app/components/actions/actionLink';
import MenuItem from 'app/components/menuItem';
import overflowEllipsis from 'app/styles/overflowEllipsis';

function MenuItemActionLink({
  className,
  ...props
}: React.ComponentProps<typeof ActionLink>) {
  return (
    <MenuItem noAnchor withBorder disabled={props.disabled} className={className}>
      <InnerActionLink {...props} />
    </MenuItem>
  );
}
const InnerActionLink = styled(ActionLink)`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis}
  &:hover {
    color: ${p => p.theme.textColor};
  }

  .dropdown-menu > li > &,
  .dropdown-menu > span > li > & {
    &.disabled:hover {
      background: ${p => p.theme.white};
      color: #7a8188;
    }
  }
`;

export default MenuItemActionLink;
