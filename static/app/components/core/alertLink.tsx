import type React from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert, type AlertProps} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

interface BaseAlertLinkProps
  extends Pick<AlertProps, 'system' | 'children' | 'trailingItems'> {
  /**
   * @deprecated Use `type` instead.
   */
  priority?: AlertProps['type'];
  /**
   * @deprecated use trailingItems instead
   */
  trailingItems?: React.ReactNode;
  type?: AlertProps['type'];
}

interface ExternalAlertLinkProps extends BaseAlertLinkProps {
  href: string;
  // @TODO(jonasbadalic): type definition used ot indicated this prop for all types, but it never actually worked for anything except external links
  // @TODO(jonasbadalic): this type should not be optional because it has a default initializer inside ExternalLink!!
  openInNewTab: boolean;
  onClick?: never;
  // Disable other props that are not applicable for this type
  to?: never;
}

interface InternalAlertLinkProps extends BaseAlertLinkProps {
  to: string;
  // Disable other props that are not applicable for this type
  href?: never;
  onClick?: never;
  openInNewTab?: never;
}

interface ManualAlertLinkProps extends BaseAlertLinkProps {
  onClick: React.MouseEventHandler<HTMLAnchorElement>;
  // Disable other props that are not applicable for this type
  href?: never;
  openInNewTab?: never;
  to?: never;
}

export type AlertLinkProps =
  | ExternalAlertLinkProps
  | InternalAlertLinkProps
  | ManualAlertLinkProps;

export function AlertLink(props: AlertLinkProps): React.ReactNode {
  const alertProps: AlertProps = {
    type: props.type ?? props.priority ?? 'info',
    system: props.system,
    trailingItems: props.trailingItems ?? <IconChevron direction="right" />,
  };

  // @TODO(jonasbadalic): we should check for empty href and report to sentry
  if ('href' in props) {
    // @TODO(jonasbadalic): Should we validate that the href is a valid URL?
    return (
      <ExternalLinkWithTextDecoration
        type={alertProps.type}
        href={props.href}
        openInNewTab={props.openInNewTab}
      >
        <Alert {...alertProps}>{props.children}</Alert>
      </ExternalLinkWithTextDecoration>
    );
  }

  if ('onClick' in props) {
    return (
      // @TODO(jonasbadalic): fix this hacky way of making the link work. It seems that doing this
      // causes the link to render a path to / which probably means that even though a manual link is specified,
      // the user might still be redirected to a path that they dont want to be redirected to?. Should this
      // be a button in this case?
      <LinkWithTextDecoration type={alertProps.type} to="" onClick={props.onClick}>
        <Alert {...alertProps}>{props.children}</Alert>
      </LinkWithTextDecoration>
    );
  }

  // @TODO(jonasbadalic): we should check for empty to value and report to sentry
  return (
    <LinkWithTextDecoration type={alertProps.type} to={props.to}>
      <Alert {...alertProps}>{props.children}</Alert>
    </LinkWithTextDecoration>
  );
}

// @TODO(jonasbadalic): the styles here are duplicated...
const ExternalLinkWithTextDecoration = styled(ExternalLink)<{
  type: AlertProps['type'];
}>`
  display: block;
  ${p => textDecorationStyles({type: p.type, theme: p.theme})}
`;

const LinkWithTextDecoration = styled(Link)<{type: AlertProps['type']}>`
  display: block;
  ${p => textDecorationStyles({type: p.type, theme: p.theme})}
`;

function textDecorationStyles({type, theme}: {theme: Theme; type: AlertProps['type']}) {
  return css`
    text-decoration-color: ${theme.alert[type].border};
    text-decoration-style: solid;
    text-decoration-line: underline;
    /* @TODO(jonasbadalic): can/should we standardize this transition? */
    transition: 0.2s border-color;

    &:hover {
      text-decoration-color: ${theme.alert[type].color};
      text-decoration-style: solid;
      text-decoration-line: underline;
    }
  `;
}

/**
 * Manages margins of AlertLink components
 */
const Container = styled('div')`
  > a {
    margin-bottom: ${space(2)};
  }
`;

AlertLink.Container = Container;
