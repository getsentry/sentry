import styled from '@emotion/styled';

import ActionLink from 'sentry/components/actions/actionLink';
import MenuItem from 'sentry/components/menuItem';

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
  ${p => p.theme.overflowEllipsis}
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
