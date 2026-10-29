import type * as React from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {getTextStyles} from '@sentry/scraps/text/text';
import type {ButtonVariant, Theme} from '@sentry/scraps/theme';
import {type AnalyticsProps, useClickTracking} from '@sentry/scraps/trackingContext';

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

const getLinkStyles = ({
  disabled,
  theme,
}: {
  theme: Theme;
  disabled?: LinkProps['disabled'];
}) => css`
  border-radius: 2px;
  pointer-events: ${disabled ? 'none' : undefined};
  /* Read the color from the theme so links follow a nested ThemeProvider,
   * which the global anchor styles can't. */
  color: ${
    disabled ? theme.tokens.content.disabled : theme.tokens.interactive.link.accent.rest
  };

  &:hover,
  &:focus-visible {
    color: ${
      disabled
        ? theme.tokens.content.disabled
        : theme.tokens.interactive.link.accent.hover
    };
  }

  &:focus-visible {
    text-decoration: none;
    ${theme.focusRing()}
  }
`;

const getLinkTextStyles = ({theme}: {theme: Theme}) => css`
  ${getTextStyles({theme, variant: 'inherit'})}
  font-family: inherit;
`;

const Anchor = styled('a', {
  shouldForwardProp: prop => isPropValid(prop) && prop !== 'disabled',
})<{disabled?: LinkProps['disabled']}>`
  ${getLinkTextStyles}
  ${getLinkStyles}
`;

type LinkPropsWithButtonBehavior = LinkProps & {
  busy?: boolean;
  variant?: ButtonVariant;
};

function LinkBase(props: LinkPropsWithButtonBehavior) {
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

const StyledLink = styled(LinkBase)`
  ${getLinkTextStyles}
  ${getLinkStyles}
`;

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
