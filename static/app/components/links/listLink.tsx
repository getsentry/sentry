// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {Link as RouterLink} from 'react-router';
import {NavLink} from 'react-router-dom';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {LocationDescriptor} from 'history';

import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';

interface ListLinkProps
  extends Omit<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
    'href' | 'target' | 'as' | 'css' | 'ref'
  > {
  /**
   * Link target. We don't want to expose the ToLocationFunction on this component.
   */
  to: LocationDescriptor;
  disabled?: boolean;
  index?: boolean;
  /**
   * Should be should be supplied by the parent component
   */
  isActive?: (location: LocationDescriptor, indexOnly?: boolean) => boolean;
}

function ListLink({
  children,
  className,
  isActive,
  to,
  index = false,
  disabled = false,
  ...props
}: ListLinkProps) {
  const router = useRouter();
  const location = useLocation();
  const target = normalizeUrl(to);

  const active =
    isActive?.(target, index) ??
    // XXX(epurkhiser): our shim for router.isActive will throw an error in
    // react-router 6. Fallback to manually checking if the path is active
    (window.__SENTRY_USING_REACT_ROUTER_SIX
      ? location.pathname === (typeof target === 'string' ? target : target.pathname)
      : router.isActive(target, index));

  const link = window.__SENTRY_USING_REACT_ROUTER_SIX ? (
    <NavLink {...props} to={disabled ? '' : locationDescriptorToTo(target)}>
      {children}
    </NavLink>
  ) : (
    <RouterLink {...props} onlyActiveOnIndex={index} to={disabled ? '' : target}>
      {children}
    </RouterLink>
  );

  return (
    <StyledLi className={classNames({active}, className)} disabled={disabled}>
      {link}
    </StyledLi>
  );
}

export default ListLink;

const StyledLi = styled('li', {
  shouldForwardProp: prop => prop !== 'disabled',
})<{disabled?: boolean}>`
  ${p =>
    p.disabled &&
    `
  a {
      color:${p.theme.disabled} !important;
      :hover {
        color: ${p.theme.disabled}  !important;
      }
      cursor: default !important;
    }

  a:active {
    pointer-events: none;
  }
`}
`;
