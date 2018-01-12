import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import InlineSvg from '../../../components/inlineSvg';

const CrossSectionLinkButtonText = styled(({children, ...props}) => (
  <div {...props}>{children}</div>
))`
  flex-grow: 1;
  margin-left: 0.75em;
`;

const CrossSectionLinkButton = styled(({href, children, ...props}) => (
  <a href={href} {...props}>
    <InlineSvg src="icon-mail" width="1.5em" height="1em" />
    <CrossSectionLinkButtonText>{children}</CrossSectionLinkButtonText>
    <InlineSvg src="icon-chevron-right" size="1em" />
  </a>
))`
  display: flex;
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
  href: PropTypes.string,
};

export default CrossSectionLinkButton;
