import styled from '@emotion/styled';
import React from 'react';
import {LocationDescriptor} from 'history';
import omit from 'lodash/omit';

import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

type Size = 'small' | 'normal';
type Priority = 'info' | 'warning' | 'success' | 'error' | 'muted';

type PropsWithHref = {href: string};
type PropsWithTo = {to: LocationDescriptor};
type OtherProps = {
  icon?: string;
  onClick?: (e: React.MouseEvent) => void;
};
type DefaultProps = {
  size: Size;
  priority: Priority;
  withoutMarginBottom: boolean;
  openInNewTab: boolean;
};

type Props = (PropsWithHref | PropsWithTo) & OtherProps & DefaultProps;

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
        {icon && <StyledInlineSvg src={icon} size="1.5em" spacingSize={size} />}
        <AlertLinkText>{children}</AlertLinkText>
        <InlineSvg src="icon-chevron-right" size="1em" />
      </StyledLink>
    );
  }
}

const StyledLink = styled((props: Omit<DefaultProps, 'openInNewTab'>) => (
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

const StyledInlineSvg = styled(InlineSvg)<{spacingSize: Size}>`
  margin-right: ${p => (p.spacingSize === 'small' ? space(1) : space(1.5))};
`;
