import {type LinkProps as ReactRouterLinkProps} from 'react-router';
import isPropValid from '@emotion/is-prop-valid';
import * as stylex from '@stylexjs/stylex';
import type {LocationDescriptor} from 'history';

import type {ButtonVariant} from '@sentry/scraps/button/types';
import {background, content, focus} from '@sentry/scraps/theme/tokens.stylex';
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

const styles = stylex.create({
  link: {
    // Text styles of an inherit-variant Text, in the inherited font.
    fontFamily: 'inherit',
    textBoxEdge: 'text text',
    textBoxTrim: 'trim-both',
    /* @TODO(jonasbadalic) This was defined on theme and only used here */
    borderRadius: '2px',
    textDecoration: {default: null, ':focus-visible': 'none'},
    outline: {default: null, ':focus-visible': 'none'},
    boxShadow: {
      default: null,
      ':focus-visible': `0 0 0 0 ${background.primary}, 0 0 0 2px ${focus.default}`,
    },
  },
  disabled: {
    pointerEvents: 'none',
    color: {default: content.disabled, ':hover': content.disabled},
  },
});

function getLinkClassName(disabled: boolean | undefined, className: string | undefined) {
  const {className: linkClassName = ''} = stylex.props(
    styles.link,
    disabled && styles.disabled
  );
  return className ? `${linkClassName} ${className}` : linkClassName;
}

function Anchor({
  disabled,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  disabled?: LinkProps['disabled'];
  ref?: React.Ref<HTMLAnchorElement>;
}) {
  const domProps: Record<string, unknown> = {};
  for (const key in props) {
    if (isPropValid(key)) {
      domProps[key] = (props as Record<string, unknown>)[key];
    }
  }
  return <a {...domProps} className={getLinkClassName(disabled, className)} />;
}

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
    return <Anchor {...(restProps as React.AnchorHTMLAttributes<HTMLAnchorElement>)} />;
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
      className={getLinkClassName(false, linkProps.className)}
      onClick={handleClick}
    />
  );
}

export function Link(props: LinkProps) {
  return <LinkBase {...props} />;
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
