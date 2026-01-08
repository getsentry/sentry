import {NavLink} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import type {LocationDescriptor} from 'history';

import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

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
   * Should be supplied by the parent component
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
  const location = useLocation();
  const target = normalizeUrl(to);

  const active =
    isActive?.(target, index) ??
    // XXX(epurkhiser): This is carry over from the react-router 3 days.
    // There's probably a a better way to detect active
    location.pathname === (typeof target === 'string' ? target : target.pathname);

  return (
    <StyledLi className={classNames({active}, className)} disabled={disabled}>
      <NavLink {...props} to={disabled ? '' : locationDescriptorToTo(target)}>
        {children}
      </NavLink>
    </StyledLi>
  );
}

export default ListLink;

const StyledLi = styled('li', {
  shouldForwardProp: prop => prop !== 'disabled',
})<{disabled?: boolean}>`
  ${p =>
    p.disabled &&
    css`
      a {
        color: ${p.theme.tokens.content.disabled} !important;
        :hover {
          color: ${p.theme.tokens.content.disabled} !important;
        }
        cursor: default !important;
      }

      a:active {
        pointer-events: none;
      }
    `}
`;
