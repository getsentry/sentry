import {
  matchRoutes,
  Link as RouterLink,
  type LinkProps as ReactRouterLinkProps,
  type To,
} from 'react-router-dom';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

export interface LinkProps
  extends React.RefAttributes<HTMLAnchorElement>,
    Pick<
      ReactRouterLinkProps,
      'to' | 'replace' | 'preventScrollReset' | 'state' | 'reloadDocument'
    >,
    Omit<
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
   * Indicator if the link should be disabled
   */
  disabled?: boolean;
}

const getLinkStyles = ({
  disabled,
  theme,
}: {
  theme: Theme;
  disabled?: LinkProps['disabled'];
}) => css`
  /* @TODO(jonasbadalic) This was defined on theme and only used here */
  border-radius: 2px;
  pointer-events: ${disabled ? 'none' : undefined};
  color: ${disabled ? theme.disabled : undefined};

  &:hover {
    color: ${disabled ? theme.disabled : undefined};
  }

  &:focus-visible {
    box-shadow: ${theme.linkFocus} 0 0 0 2px;
    text-decoration: none;
    outline: none;
  }
`;

const Anchor = styled('a', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
})<{disabled?: LinkProps['disabled']}>`
  ${getLinkStyles}
`;

const preload = async (to: To) => {
  // Try to match the route and preload if it has a preload method
  try {
    const routeConfig = (await import('sentry/routes')).routes();
    const matches = matchRoutes(routeConfig, to);

    if (matches && matches.length > 0) {
      // Preload all matching routes, not just the last one
      for (const match of matches) {
        const routeHandle = match.route.handle;

        // Check if the handle has a preload method
        if (routeHandle && typeof routeHandle === 'object' && 'preload' in routeHandle) {
          routeHandle.preload?.().catch(() => {
            // Ignore preload errors
          });
        }
      }
    }
  } catch {
    // Silently fail if route matching fails
  }
};

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present
 */
export const Link = styled(
  ({disabled, to, onMouseEnter, onFocus, ...props}: LinkProps) => {
    const location = useLocation();

    if (disabled || !location) {
      return <Anchor {...props} />;
    }

    const normalizedTo = locationDescriptorToTo(normalizeUrl(to, location));

    return (
      <RouterLink
        to={normalizedTo}
        onMouseEnter={e => {
          onMouseEnter?.(e);
          void preload(normalizedTo);
        }}
        onFocus={e => {
          onFocus?.(e);
          void preload(normalizedTo);
        }}
        {...props}
      />
    );
  }
)`
  ${getLinkStyles}
`;

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  disabled?: LinkProps['disabled'];
  openInNewTab?: boolean;
}

export function ExternalLink({openInNewTab = true, ...props}: ExternalLinkProps) {
  if (openInNewTab) {
    return <Anchor {...props} target="_blank" rel="noreferrer noopener" />;
  }

  return <Anchor {...props} href={props.href} />;
}
