import {forwardRef, useEffect} from 'react';
import {Link as RouterLink, withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptor} from 'history';

import {linkStyles} from './styles';

export interface LinkProps
  extends Omit<
    React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
    'href' | 'target' | 'as' | 'css'
  > {
  /**
   * The string path or LocationDescriptor object
   */
  to: ((location: Location) => LocationDescriptor) | LocationDescriptor;
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

interface WithRouterBaseLinkProps extends WithRouterProps, LinkProps {}

function BaseLink({
  location,
  disabled,
  to,
  forwardedRef,
  router: _router,
  params: _params,
  routes: _routes,
  ...props
}: WithRouterBaseLinkProps): React.ReactElement {
  useEffect(() => {
    // check if the router is present
    if (!location) {
      Sentry.captureException(
        new Error('The link component was rendered without being wrapped by a <Router />')
      );
    }
  }, [location]);

  if (!disabled && location) {
    return <RouterLink to={to} ref={forwardedRef as any} {...props} />;
  }

  return <a href={typeof to === 'string' ? to : ''} ref={forwardedRef} {...props} />;
}

// Re-assign to Link to make auto-importing smarter
const Link = withRouter(
  styled(
    forwardRef<HTMLAnchorElement, Omit<WithRouterBaseLinkProps, 'forwardedRef'>>(
      (props, ref) => <BaseLink forwardedRef={ref} {...props} />
    )
  )`
    ${linkStyles}
  `
);

export default Link;
