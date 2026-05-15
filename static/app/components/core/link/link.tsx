import {type LinkProps as ReactRouterLinkProps} from 'react-router-dom';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {isExternalUrl} from './isExternalUrl';
import {type ResolvedLinkProps, useLinkBehavior} from './linkBehaviorContext';

/**
 * Props for the `<Link>` component.
 *
 * Accepts either `href` (preferred) or `to` (deprecated) as the link
 * destination. When `href` is an external URL (`http://`, `https://`, or
 * protocol-relative `//`), the link renders as a plain `<a>` with
 * `target="_blank"` and security attributes by default. Otherwise it
 * routes through React Router and the LinkBehaviorContext.
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
      'href' | 'as' | 'css'
    > {
  [key: `data-${string}`]: string | undefined;
  /**
   * Indicator if the link should be disabled
   */
  disabled?: boolean;
  /**
   * The link destination. Accepts a URL string or a `LocationDescriptor` object.
   *
   * External URLs (starting with `http://`, `https://`, or protocol-relative
   * `//`) automatically render as `<a>` elements with `target="_blank"` and
   * `rel="noreferrer noopener"`. Internal paths are routed through React Router.
   *
   * When using literal paths, use slug-based URLs (e.g. `/organizations/${slug}/issues/`)
   * to ensure compatibility across deployment environments.
   */
  href?: string | LocationDescriptor;
  /**
   * Whether to open the link in a new tab. Defaults to `true` for external URLs,
   * `false` for internal URLs.
   */
  openInNewTab?: boolean;
  /**
   * The string path or LocationDescriptor object for internal routing.
   *
   * @deprecated Use `href` instead. The `href` prop provides a unified API that
   * automatically handles both internal and external URLs.
   */
  to?: LocationDescriptor;
}

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

export const Link = styled(({href, to, openInNewTab, ...props}: LinkProps) => {
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
  const newTabProps = openInNewTab
    ? {target: '_blank' as const, rel: 'noreferrer noopener'}
    : {};

  return <InternalLink {...props} {...newTabProps} to={resolvedHref} />;
})`
  ${getLinkStyles}
`;

function InternalLink(props: ResolvedLinkProps) {
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
