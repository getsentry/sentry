import {forwardRef} from 'react';
// biome-ignore lint/nursery/noRestrictedImports: Will be removed with react router 6
import {Link as RouterLink} from 'react-router';
import {Link as Router6Link} from 'react-router-dom';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

import {linkStyles} from './styles';

export interface LinkProps
  extends Omit<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
    'href' | 'target' | 'as' | 'css'
  > {
  /**
   * The string path or LocationDescriptor object.
   *
   * If your link target is a string literal or a `LocationDescriptor` with
   * a literal `pathname`, you need to use the slug based URL
   * e.g `/organizations/${slug}/issues/`. This ensures that your link will
   * work in environments that do have customer-domains (saas) and those without
   * customer-domains (single-tenant).
   */
  to: LocationDescriptor;
  /**
   * Style applied to the component's root
   */
  className?: string;
  /**
   * Indicator if the link should be disabled
   */
  disabled?: boolean;
  /**
   * Forwarded ref
   */
  forwardedRef?: React.Ref<HTMLAnchorElement>;
}

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present
 */
function BaseLink({disabled, to, forwardedRef, ...props}: LinkProps): React.ReactElement {
  const location = useLocation();
  to = normalizeUrl(to, location);

  if (!disabled && location) {
    if (window.__SENTRY_USING_REACT_ROUTER_SIX) {
      return (
        <Router6Link
          to={locationDescriptorToTo(to)}
          ref={forwardedRef as any}
          {...props}
        />
      );
    }

    return <RouterLink to={to} ref={forwardedRef as any} {...props} />;
  }

  return <a href={typeof to === 'string' ? to : ''} ref={forwardedRef} {...props} />;
}

// Re-assign to Link to make auto-importing smarter
const Link = styled(
  forwardRef<HTMLAnchorElement, Omit<LinkProps, 'forwardedRef'>>((props, ref) => (
    <BaseLink forwardedRef={ref} {...props} />
  ))
)`
  ${linkStyles}
`;

export default Link;
