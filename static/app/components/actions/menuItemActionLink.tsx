import * as React from 'react';
import styled from '@emotion/styled';

import ActionLink from 'sentry/components/actions/actionLink';
import MenuItem from 'sentry/components/menuItem';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';

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
      background: ${p => p.theme.background};
    }
  }
`;

export default MenuItemActionLink;
