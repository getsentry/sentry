import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import Link from 'app/components/links/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

type Props = Link['props'] & {
  icon: string;
  priority?: 'info' | 'warning' | 'success' | 'error' | 'muted';
  size?: 'small' | 'normal';
};

export default class AlertLink extends React.Component<Props> {
  static propTypes = {
    to: PropTypes.string,
    href: PropTypes.string,
    icon: PropTypes.string,
    priority: PropTypes.oneOf(['info', 'warning', 'success', 'error', 'muted']),
    size: PropTypes.oneOf(['small', 'normal']),
  };

  static defaultProps = {
    priority: 'warning',
  };

  render() {
    const {icon, children, size} = this.props;

    return (
      <StyledLink {...this.props}>
        {icon && <StyledInlineSvg src={icon} size="1.5em" spacingSize={size} />}
        <AlertLinkText>{children}</AlertLinkText>
        <InlineSvg src="icon-chevron-right" size="1em" />
      </StyledLink>
    );
  }
}

const StyledLink = styled(Link)<{priority: string; size?: string}>`
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

const StyledInlineSvg = styled(InlineSvg)<{spacingSize: string}>`
  margin-right: ${p => (p.spacingSize === 'small' ? space(1) : space(1.5))};
`;
