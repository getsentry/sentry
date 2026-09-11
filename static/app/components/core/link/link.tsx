import {type LinkProps as ReactRouterLinkProps} from 'react-router-dom';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import type {ButtonVariant} from '@sentry/scraps/button/types';
import {type AnalyticsProps, useClickTracking} from '@sentry/scraps/trackingContext';

import {useLinkBehavior} from './linkBehaviorContext';

export interface LinkProps
  extends
    React.RefAttributes<HTMLAnchorElement>,
    AnalyticsProps,
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
})<{disabled?: LinkProps['disabled']}>`
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

  if (props.disabled) {
    // Removing the "to" prop here to prevent the anchor from being rendered with to="
    // [object Object]" when "to" prop is a LocationDescriptor object. Have to create a
    // new object here, as we can't delete the "to" prop as it is a required prop.
    const {to: _to, ...restProps} = props;
    return <Anchor {...restProps} />;
  }

  const {
    analyticsEventKey: _analyticsEventKey,
    analyticsEventName: _analyticsEventName,
    analyticsParams: _analyticsParams,
    busy: _busy,
    variant: _variant,
    ...linkProps
  } = propsWithBehavior;

  return <Component {...linkProps} onClick={handleClick} />;
}

const StyledLink = styled(LinkBase)`
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
