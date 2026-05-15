import {type LinkProps as ReactRouterLinkProps} from 'react-router-dom';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {isExternalUrl} from './isExternalUrl';
import {useLinkBehavior} from './linkBehaviorContext';

/**
 * Props for internal (routed) links. Used by the LinkBehaviorContext to
 * normalize and transform link destinations before rendering.
 */
export interface RoutedLinkProps
  extends
    React.RefAttributes<HTMLAnchorElement>,
    Pick<
      ReactRouterLinkProps,
      'to' | 'replace' | 'preventScrollReset' | 'state' | 'reloadDocument'
    >,
    Omit<
      React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
      'href' | 'target' | 'as' | 'css'
    > {
  [key: `data-${string}`]: string | undefined;
  /**
   * The string path or LocationDescriptor object.
   */
  to: LocationDescriptor;
  /**
   * Indicator if the link should be disabled
   */
  disabled?: boolean;
}

/**
 * Public props for the `<Link>` component.
 *
 * Accepts either `href` (preferred) or `to` (deprecated) as the link
 * destination. When `href` is an external URL (`http://` or `https://`),
 * the link renders as a plain `<a>` with `target="_blank"` and security
 * attributes. Otherwise it routes through React Router.
 */
export interface LinkProps
  extends
    React.RefAttributes<HTMLAnchorElement>,
    Pick<
      ReactRouterLinkProps,
      'replace' | 'preventScrollReset' | 'state' | 'reloadDocument'
    >,
    Omit<
      React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
      'href' | 'target' | 'as' | 'css'
    > {
  [key: `data-${string}`]: string | undefined;
  /**
   * The string path or LocationDescriptor object.
   *
   * @deprecated Use `href` instead. The `href` prop provides a unified API that
   * automatically handles both internal and external URLs.
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
  /**
   * The link destination. Accepts a URL string or a `LocationDescriptor` object.
   *
   * External URLs (starting with `http://` or `https://`) automatically render as
   * `<a>` elements with `target="_blank"` and `rel="noreferrer noopener"`. Internal
   * paths are routed through React Router.
   *
   * When using literal paths, use slug-based URLs (e.g. `/organizations/${slug}/issues/`)
   * to ensure compatibility across deployment environments.
   */
  href?: string | LocationDescriptor;
  /**
   * Whether to open external links in a new tab. Defaults to `true` for external URLs,
   * `false` for internal URLs.
   */
  openInNewTab?: boolean;
}

/**
 * Internal component props that relax the `to` requirement so callers
 * can pass just `href` without providing `to`.
 */
type LinkComponentProps = Omit<LinkProps, 'to'> & {to?: LocationDescriptor};

const getLinkStyles = ({disabled, theme}: {theme: Theme; disabled?: boolean}) => css`
  /* @TODO(jonasbadalic) This was defined on theme and only used here */
  border-radius: 2px;
  pointer-events: ${disabled ? 'none' : undefined};
  color: ${disabled ? theme.tokens.content.disabled : undefined};

  &:hover {
    color: ${disabled ? theme.tokens.content.disabled : undefined};
  }

  &:focus-visible {
    text-decoration: none;
    ${theme.focusRing()}
  }
`;

const Anchor = styled('a', {
  shouldForwardProp: prop => isPropValid(prop) && prop !== 'disabled',
})<{disabled?: boolean}>`
  ${getLinkStyles}
`;

export const Link = styled(({href, to, openInNewTab, ...props}: LinkComponentProps) => {
  const resolvedHref = href ?? to;

  // Disabled state: render an inert anchor with no destination
  if (props.disabled) {
    return <Anchor {...props} />;
  }

  // External URL: render a plain <a> with security attributes
  if (isExternalUrl(resolvedHref)) {
    const shouldOpenInNewTab = openInNewTab ?? true;
    return (
      <Anchor
        {...props}
        href={resolvedHref}
        {...(shouldOpenInNewTab
          ? {target: '_blank', rel: 'noreferrer noopener'}
          : undefined)}
      />
    );
  }

  // Neither href nor to was provided — render an inert anchor
  if (resolvedHref === undefined) {
    return <Anchor {...props} />;
  }

  // Internal link: delegate to the link behavior context (React Router)
  return <InternalLink {...props} to={resolvedHref} />;
})`
  ${getLinkStyles}
`;

/**
 * Internal-only link that delegates to the LinkBehaviorContext.
 * Separated so the `useLinkBehavior` hook receives a proper `to` prop.
 */
function InternalLink(props: RoutedLinkProps) {
  const {Component, behavior} = useLinkBehavior(props);
  return <Component {...behavior()} />;
}

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  disabled?: boolean;
  openInNewTab?: boolean;
}

/**
 * @deprecated Use `<Link href="...">` instead. The `Link` component now
 * automatically detects external URLs and applies the correct `target` and
 * `rel` attributes.
 */
export function ExternalLink({openInNewTab = true, ...props}: ExternalLinkProps) {
  if (openInNewTab) {
    return <Anchor {...props} target="_blank" rel="noreferrer noopener" />;
  }

  return <Anchor {...props} href={props.href} />;
}
