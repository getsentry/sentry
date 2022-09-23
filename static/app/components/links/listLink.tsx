// eslint-disable-next-line no-restricted-imports
import {Link as RouterLink, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import classNames from 'classnames';
import {LocationDescriptor} from 'history';
import * as qs from 'query-string';

type LinkProps = Omit<React.ComponentProps<typeof RouterLink>, 'to'>;

type Props = WithRouterProps &
  LinkProps & {
    /**
     * Link target. We don't want to expose the ToLocationFunction on this component.
     */
    to: LocationDescriptor;
    /**
     * The class to apply when the link is 'active'
     */
    activeClassName?: string;
    disabled?: boolean;
    index?: boolean;
    /**
     * Should be should be supplied by the parent component
     */
    isActive?: (location: LocationDescriptor, indexOnly?: boolean) => boolean;
    query?: string;
  };

function ListLink({
  children,
  className,
  isActive,
  query,
  router,
  to,
  activeClassName = 'active',
  index = false,
  disabled = false,
  ...props
}: Props) {
  const queryData = query ? qs.parse(query) : undefined;
  const target: LocationDescriptor =
    typeof to === 'string' ? {pathname: to, query: queryData} : to;

  const active = isActive?.(target, index) ?? router.isActive(target, index);

  return (
    <StyledLi
      className={classNames({[activeClassName]: active}, className)}
      disabled={disabled}
    >
      <RouterLink {...props} onlyActiveOnIndex={index} to={disabled ? '' : to}>
        {children}
      </RouterLink>
    </StyledLi>
  );
}

export default withRouter(ListLink);

const StyledLi = styled('li', {
  shouldForwardProp: prop => prop !== 'disabled',
})<{disabled?: boolean}>`
  ${p =>
    p.disabled &&
    `
   a {
    color:${p.theme.disabled} !important;
    pointer-events: none;
    :hover {
      color: ${p.theme.disabled}  !important;
    }
   }
`}
`;
