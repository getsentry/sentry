import {forwardRef, useEffect} from 'react';
import {Link as RouterLink, withRouter, WithRouterProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptor} from 'history';

import {Theme} from 'sentry/utils/theme';

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
    return <StyledRouterLink to={to} ref={forwardedRef as any} {...props} />;
  }

  if (typeof to === 'string') {
    return <Anchor href={to} ref={forwardedRef} disabled={disabled} {...props} />;
  }

  return <Anchor href="" ref={forwardedRef} {...props} disabled />;
}

// Set the displayName for testing convenience
BaseLink.displayName = 'Link';

// Re-assign to Link to make auto-importing smarter
const Link = withRouter(
  forwardRef<HTMLAnchorElement, Omit<WithRouterBaseLinkProps, 'forwardedRef'>>(
    (props, ref) => <BaseLink forwardedRef={ref} {...props} />
  )
);

export default Link;

const linkStyles = ({disabled, theme}: {theme: Theme; disabled?: boolean}) => `
  border-radius: ${theme.borderRadius};

  &.focus-visible {
    box-shadow: ${theme.linkFocus} 0 0 0 2px;
    text-decoration: none;
    outline: none;
  }

  ${
    disabled &&
    `
      color:${theme.disabled};
      pointer-events: none;
      :hover {
        color: ${theme.disabled};
      }
    `
  }
`;

const StyledRouterLink = styled(RouterLink)`
  ${linkStyles}
`;

export const Anchor = styled('a', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
})<{disabled?: boolean}>`
  ${linkStyles}
`;
