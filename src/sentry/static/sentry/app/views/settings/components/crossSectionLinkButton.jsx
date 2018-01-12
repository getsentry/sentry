import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import Link from '../../../components/link';
import InlineSvg from '../../../components/inlineSvg';

const CrossSectionLinkButtonText = styled(({children, ...props}) => (
  <div {...props}>{children}</div>
))`
  flex-grow: 1;

  &:not(:first-child) {
    margin-left: 0.75em;
  }
`;

const CrossSectionLinkButton = styled(({to, children, icon, ...props}) => (
  <Link to={to} {...props}>
    <InlineSvg src={icon} size="1.5em" />
    <CrossSectionLinkButtonText>{children}</CrossSectionLinkButtonText>
    <InlineSvg src="icon-chevron-right" size="1em" />
  </Link>
))`
  display: flex;
  align-items: center;
  background-color: ${t => t.theme.yellowLightest};
  color: ${t => t.theme.gray5};
  border: 1px dashed ${t => t.theme.borderDark};
  padding: 1em;
  border-radius: 0.25em;
  transition: 0.2s border-color;

  &:hover {
    border-color: ${t => t.theme.blueLight};
  }
`;

CrossSectionLinkButton.propTypes = {
  to: PropTypes.string,
};

export default CrossSectionLinkButton;
