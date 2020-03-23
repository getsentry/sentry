import styled from '@emotion/styled';
import React from 'react';
import {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import {IconChevron} from 'app/icons';
import space from 'app/styles/space';

type Size = 'small' | 'normal';
type Priority = 'info' | 'warning' | 'success' | 'error' | 'muted';

type PropsWithHref = {href: string};
type PropsWithTo = {to: LocationDescriptor};
type OtherProps = {
  icon?: string | React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
};
type DefaultProps = {
  size: Size;
  priority: Priority;
  withoutMarginBottom: boolean;
  openInNewTab: boolean;
};

type Props = (PropsWithHref | PropsWithTo) & OtherProps & DefaultProps;

// TODO(Priscila): Improve it as soon as we merge this PR: https://github.com/getsentry/sentry/pull/17346
type StyledLinkProps = PropsWithHref &
  PropsWithTo &
  Omit<DefaultProps, 'openInNewTab'> &
  Pick<OtherProps, 'onClick'> & {
    target: '_blank' | '_self';
  };

export default class AlertLink extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    priority: 'warning',
    size: 'normal',
    withoutMarginBottom: false,
    openInNewTab: false,
  };

  render() {
    const {
      size,
      priority,
      icon,
      children,
      onClick,
      withoutMarginBottom,
      openInNewTab,
    } = this.props;
    return (
      <StyledLink
        to={(this.props as PropsWithTo).to}
        href={(this.props as PropsWithHref).href}
        onClick={onClick}
        size={size}
        priority={priority}
        withoutMarginBottom={withoutMarginBottom}
        target={openInNewTab ? '_blank' : '_self'}
      >
        {icon && (
          <IconWrapper>
            {typeof icon === 'string' ? <InlineSvg src={icon} /> : icon}
          </IconWrapper>
        )}
        <AlertLinkText>{children}</AlertLinkText>
        <IconChevron direction="right" size="md" />
      </StyledLink>
    );
  }
}

const StyledLink = styled((props: StyledLinkProps) => (
  <Link {...omit(props, ['withoutMarginBottom', 'priority', 'size'])} />
))`
  display: flex;
  align-items: center;
  background-color: ${p => p.theme.alert[p.priority].backgroundLight};
  color: ${p => p.theme.gray4};
  border: 1px dashed ${p => p.theme.alert[p.priority].border};
  padding: ${p => (p.size === 'small' ? `${space(1)} ${space(1.5)}` : space(2))};
  margin-bottom: ${p => (p.withoutMarginBottom ? 0 : space(3))};
  border-radius: 0.25em;
  transition: 0.2s border-color;

  &:hover {
    border-color: ${p => p.theme.blueLight};
  }

  &.focus-visible {
    outline: none;
    box-shadow: ${p => p.theme.alert[p.priority].border}7f 0 0 0 2px;
  }
`;

const AlertLinkText = styled('div')`
  flex-grow: 1;
`;

const IconWrapper = styled('span')`
  display: flex;
  margin-right: ${space(1.5)};
`;
