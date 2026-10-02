import {NavLink} from 'react-router-dom';
import classNames from 'classnames';
import type {LocationDescriptor} from 'history';

import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

interface ListLinkProps extends Omit<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
  'href' | 'target' | 'as' | 'css' | 'ref'
> {
  /**
   * Link target. We don't want to expose the ToLocationFunction on this component.
   */
  to: LocationDescriptor;
  index?: boolean;
}

export function ListLink({
  children,
  className,
  to,
  index: _index,
  ...props
}: ListLinkProps) {
  const location = useLocation();
  const target = normalizeUrl(to);

  const active =
    // XXX(epurkhiser): This is carry over from the react-router 3 days.
    // There's probably a better way to detect active
    location.pathname === (typeof target === 'string' ? target : target.pathname);

  return (
    <li className={classNames({active}, className)}>
      <NavLink {...props} to={locationDescriptorToTo(target)}>
        {children}
      </NavLink>
    </li>
  );
}
