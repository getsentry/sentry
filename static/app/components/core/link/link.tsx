import {type LinkProps as ReactRouterLinkProps} from 'react-router-dom';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {useLinkBehavior} from './linkBehaviorContext';

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

export const Link = styled((props: LinkProps) => {
  const {Component, behavior} = useLinkBehavior(props);

  if (props.disabled) {
    // Removing the "to" prop here to prevent the anchor from being rendered with to="
    // [object Object]" when "to" prop is a LocationDescriptor object. Have to create a
    // new object here, as we can't delete the "to" prop as it is a required prop.
    const {to: _to, ...restProps} = props;
    return <Anchor {...restProps} />;
  }

  return <Component {...behavior()} />;
})`
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
