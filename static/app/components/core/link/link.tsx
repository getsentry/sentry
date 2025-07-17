import {
  Link as RouterLink,
  type LinkProps as ReactRouterLinkProps,
} from 'react-router-dom';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {locationDescriptorToTo} from 'sentry/utils/reactRouter6Compat/location';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';

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
  preventScrollReset?: ReactRouterLinkProps['preventScrollReset'];
  replace?: ReactRouterLinkProps['replace'];
  state?: ReactRouterLinkProps['state'];
}

const linkStyles = ({disabled, theme}: {theme: Theme; disabled?: boolean}) => css`
  /* @TODO(jonasbadalic) This was defined on theme and only used here */
  border-radius: 2px;

  &:focus-visible {
    box-shadow: ${theme.linkFocus} 0 0 0 2px;
    text-decoration: none;
    outline: none;
  }

  ${disabled &&
  css`
    color: ${theme.disabled};
    pointer-events: none;
    :hover {
      color: ${theme.disabled};
    }
  `}
`;

/**
 * A context-aware version of Link (from react-router) that falls
 * back to <a> if there is no router present
 */
export const Link = styled(({disabled, to, ...props}: LinkProps) => {
  const location = useLocation();
  to = normalizeUrl(to, location);

  if (!disabled && location) {
    return <RouterLink to={locationDescriptorToTo(to)} {...props} />;
  }

  return <Anchor href={typeof to === 'string' ? to : ''} {...props} />;
})`
  ${linkStyles}
`;

export const Anchor = styled('a', {
  shouldForwardProp: prop =>
    typeof prop === 'string' && isPropValid(prop) && prop !== 'disabled',
})<{disabled?: boolean}>`
  ${linkStyles}
`;
