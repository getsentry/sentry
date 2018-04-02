import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import Link from './link';
import InlineSvg from './inlineSvg';

const AlertLinkText = styled('div')`
  flex-grow: 1;
`;

const StyledInlineSvg = styled(InlineSvg)`
  margin-right: 0.75em;
`;

const AlertLink = styled(({children, icon, ...props}) => (
  <Link {...props}>
    {icon && <StyledInlineSvg src={icon} size="1.5em" />}
    <AlertLinkText>{children}</AlertLinkText>
    <InlineSvg src="icon-chevron-right" size="1em" />
  </Link>
))`
  display: flex;
  align-items: center;
  background-color: ${t => t.theme.yellowLightest};
  color: ${t => t.theme.gray5};
  border: 1px dashed ${t => t.theme.borderDark};
  padding: ${t => t.theme.grid * 2}px;
  margin-bottom: ${t => t.theme.grid * 4}px;
  border-radius: 0.25em;
  transition: 0.2s border-color;

  &:hover {
    border-color: ${t => t.theme.blueLight};
  }
`;

AlertLink.propTypes = {
  to: PropTypes.string,
  href: PropTypes.string,
  icon: PropTypes.string,
};

export default AlertLink;
