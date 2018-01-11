import styled from 'react-emotion';
import PropTypes from 'prop-types';
import React from 'react';

const CrossSectionLinkButton = styled(props => {
  return React.createElement('a', {href: props.href}, props.children);
})`
  color: blue;
`;

CrossSectionLinkButton.propTypes = {
  href: PropTypes.string,
};

export default CrossSectionLinkButton;
