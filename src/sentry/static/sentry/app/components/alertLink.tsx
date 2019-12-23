import styled from 'react-emotion';
import React from 'react';
import {LocationDescriptor} from 'history';

import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

type Size = 'small' | 'normal';
type Priority = 'info' | 'warning' | 'success' | 'error' | 'muted';

type Props = {
  // do we need to enforce here to always provide either href or to?
  href?: string;
  to?: LocationDescriptor;
  icon?: string;
  size: Size;
  priority: Priority;
  onClick?: (e: React.MouseEvent) => void;
};

export default class AlertLink extends React.Component<Props> {
  static defaultProps = {
    priority: 'warning',
    size: 'normal',
  };

  render() {
    const {to, href, size, priority, icon, children, onClick} = this.props;
    return (
      <StyledLink {...{to, href, size, priority, onClick}}>
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
