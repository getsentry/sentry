import type * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, styled} from '@yak/react';

import type {ButtonVariant} from '@sentry/scraps/theme';
import {type AnalyticsProps, useClickTracking} from '@sentry/scraps/trackingContext';
import {withYakProps, withYakTheme} from '@sentry/scraps/yak';

import {useLinkBehavior} from './linkBehaviorContext';

export interface LinkProps
  extends
    React.RefAttributes<HTMLAnchorElement>,
    AnalyticsProps,
    Omit<
      React.DetailedHTMLProps<React.HTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>,
      'href' | 'target' | 'as' | 'css'
    > {
  [key: `data-${string}`]: string | undefined;
  /**
   * The string path or destination object. A LinkBehaviorContextProvider can
   * normalize destinations and handle client-side routing.
   */
  to:
    | string
    | {
        hash?: string;
        pathname?: string;
        query?: Record<string, unknown>;
        search?: string;
        state?: unknown;
      };
  /**
   * Indicator if the link should be disabled
   */
  disabled?: boolean;
  preventScrollReset?: boolean;
  reloadDocument?: boolean;
  replace?: boolean;
  state?: unknown;
}

/**
 * Where something leads: a route inside the product, or an external URL
 * outside it. The two are mutually exclusive, so a component can pick `Link`
 * or `ExternalLink` from whichever one it was handed.
 */
export type LinkDestination =
  | {to: LinkProps['to']; externalHref?: never}
  | {externalHref: string; to?: never};

const linkStyles = css<{disabled?: boolean}>`
  border-radius: 2px;
  ${p =>
    p.disabled &&
    css`
      pointer-events: none;
    `}
  color: ${p => (p.disabled ? p.theme.tokens.content.disabled : p.theme.tokens.interactive.link.accent.rest)};
  &:hover,
  &:focus-visible {
    color: ${p => (p.disabled ? p.theme.tokens.content.disabled : p.theme.tokens.interactive.link.accent.hover)};
  }
  &:focus-visible {
    text-decoration: none;
    outline: none;
    box-shadow: ${p => p.theme.focusRing().boxShadow};
  }
  font-family: inherit;
  text-box-edge: text text;
  text-box-trim: trim-both;
`;
const Anchor = withYakTheme(styled(
  withYakProps('a', prop => isPropValid(prop) && prop !== 'disabled')
)<{disabled?: boolean}>`
  ${linkStyles};
`);
type LinkPropsWithButtonBehavior = LinkProps & {
  busy?: boolean;
  variant?: ButtonVariant;
};

export function LinkBase(props: LinkPropsWithButtonBehavior) {
  const {Component, behavior} = useLinkBehavior(props);
  // LinkButton reuses this component for router links and passes these
  // button-only props through at runtime. They are consumed by tracking and
  // removed before reaching the router or DOM element.
  const propsWithBehavior = behavior();
  const {handleClick} = useClickTracking(propsWithBehavior, 'link');

  const {
    analyticsEventKey: _analyticsEventKey,
    analyticsEventName: _analyticsEventName,
    analyticsParams: _analyticsParams,
    busy: _busy,
    variant: _variant,
    ...linkProps
  } = props.disabled ? props : propsWithBehavior;

  if (props.disabled) {
    const {
      to: _to,
      replace: _replace,
      preventScrollReset: _preventScrollReset,
      reloadDocument: _reloadDocument,
      state: _state,
      ...restProps
    } = linkProps;
    return <Anchor {...restProps} />;
  }

  return <Component {...linkProps} onClick={handleClick} />;
}

const StyledLink = withYakTheme(styled(withYakProps(LinkBase, () => true))`
  ${linkStyles};
`);

export function Link(props: LinkProps) {
  return <StyledLink {...props} />;
}

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
