import styled from 'react-emotion';
import React from 'react';
import {LocationDescriptor} from 'history';

import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

type Size = 'small' | 'normal';
type Priority = 'info' | 'warning' | 'success' | 'error' | 'muted';

type PropsWithHref = {href: string};
type PropsWithTo = {to: LocationDescriptor};
type OtherProps = {
  icon?: string;
  size: Size;
  priority: Priority;
  onClick?: (e: React.MouseEvent) => void;
};

type Props = (PropsWithHref | PropsWithTo) & OtherProps;

export default class AlertLink extends React.Component<Props> {
  static defaultProps: Partial<Props> = {
    priority: 'warning',
    size: 'normal',
  };

  render() {
    const {size, priority, icon, children, onClick} = this.props;
    return (
      <StyledLink
        to={(this.props as PropsWithTo).to}
        href={(this.props as PropsWithHref).href}
        onClick={onClick}
        size={size}
        priority={priority}
      >
        {icon && <StyledInlineSvg src={icon} size="1.5em" spacingSize={size} />}
        <AlertLinkText>{children}</AlertLinkText>
        <InlineSvg src="icon-chevron-right" size="1em" />
      </StyledLink>
    );
  }
}

const StyledLink = styled(Link)<{priority: Priority; size: Size}>`
  display: flex;
  align-items: center;
  background-color: ${p => p.theme.alert[p.priority].backgroundLight};
  color: ${p => p.theme.gray4};
  border: 1px dashed ${p => p.theme.alert[p.priority].border};
  padding: ${p => (p.size === 'small' ? `${space(1)} ${space(1.5)}` : space(2))};
  margin-bottom: ${space(3)};
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
