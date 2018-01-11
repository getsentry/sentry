import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

const CrossSectionLinkButton = styled(({href, children}) => (
  <a href={href}>{children}</a>
))`
  color: blue;
`;

CrossSectionLinkButton.propTypes = {
  href: PropTypes.string,
};

export default CrossSectionLinkButton;
