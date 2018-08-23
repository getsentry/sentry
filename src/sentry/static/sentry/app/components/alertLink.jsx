import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import Link from 'app/components/link';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

export default class AlertLink extends React.Component {
  static propTypes = {
    to: PropTypes.string,
    href: PropTypes.string,
    icon: PropTypes.string,
    priority: PropTypes.string,
  };

  static defaultProps = {
    priority: 'warning',
  };

  render() {
    let {icon, children} = this.props;

    return (
      <StyledLink {...this.props}>
        {icon && <StyledInlineSvg src={icon} size="1.5em" />}
        <AlertLinkText>{children}</AlertLinkText>
        <InlineSvg src="icon-chevron-right" size="1em" />
      </StyledLink>
    );
  }
}

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  background-color: ${p => p.theme.alert[p.priority].backgroundLight};
  color: ${p => p.theme.gray4};
  border: 1px dashed ${p => p.theme.alert[p.priority].border};
  padding: ${space(2)};
  margin-bottom: ${space(3)};
  border-radius: 0.25em;
  transition: 0.2s border-color;

  &:hover {
    border-color: ${p => p.theme.blueLight};
  }
`;

const AlertLinkText = styled('div')`
  flex-grow: 1;
`;

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: 0.75em;
`;
