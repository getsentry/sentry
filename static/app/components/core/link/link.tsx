import {type LinkProps as ReactRouterLinkProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import {css, cx, type LinariaClassName} from '@linaria/core';
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
  /** Emotion css is not supported; use an Emotion styled wrapper. */
  css?: never;
  /** Custom styles from Linaria css; Emotion styles are not supported. */
  customCss?: LinariaClassName;
  /**
   * Indicator if the link should be disabled
   */
  disabled?: boolean;
}

const styles = {
  link: css`
    font-family: inherit;
    text-box-edge: text text;
    text-box-trim: trim-both;
    border-radius: 2px;
    &:focus-visible {
      text-decoration: none;
      outline: none;
      box-shadow:
        0 0 0 0 var(--ln-background-primary, #ffffff),
        0 0 0 2px var(--ln-focus-default, #7553ff);
    }
  `,
  disabled: css`
    pointer-events: none;
    color: var(--ln-content-disabled, #878490);
    &:hover {
      color: var(--ln-content-disabled, #878490);
    }
  `,
};

function getLinkClassName(
  disabled: boolean | undefined,
  className: string | undefined,
  customCss?: LinariaClassName
) {
  return cx(styles.link, disabled && styles.disabled, customCss, className);
}

function Anchor({
  customCss,
  disabled,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  css?: never;
  customCss?: LinariaClassName;
  disabled?: LinkProps['disabled'];
  ref?: React.Ref<HTMLAnchorElement>;
}) {
  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (isPropValid(key)) {
      domProps[key] = (props as Record<string, unknown>)[key];
    }
  }
  return <a {...domProps} className={getLinkClassName(disabled, className, customCss)} />;
}

type LinkPropsWithButtonBehavior = LinkProps & {
  busy?: boolean;
  variant?: ButtonVariant;
};

function LinkBase({customCss, ...props}: LinkPropsWithButtonBehavior) {
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
    return (
      <Anchor
        {...(restProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        customCss={customCss}
      />
    );
  }

  const {
    analyticsEventKey: _analyticsEventKey,
    analyticsEventName: _analyticsEventName,
    analyticsParams: _analyticsParams,
    busy: _busy,
    variant: _variant,
    ...linkProps
  } = propsWithBehavior;

  return (
    <Component
      {...linkProps}
      className={getLinkClassName(false, linkProps.className, customCss)}
      onClick={handleClick}
    />
  );
}

export function Link(props: LinkProps) {
  return <LinkBase {...props} />;
}

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Emotion css is not supported; use an Emotion styled wrapper. */
  css?: never;
  /** Custom styles from Linaria css; Emotion styles are not supported. */
  customCss?: LinariaClassName;
  disabled?: LinkProps['disabled'];
  openInNewTab?: boolean;
}

export function ExternalLink({openInNewTab = true, ...props}: ExternalLinkProps) {
  if (openInNewTab) {
    return <Anchor {...props} target="_blank" rel="noreferrer noopener" />;
  }

  return <Anchor {...props} href={props.href} />;
}
