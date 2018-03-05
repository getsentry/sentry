import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from './buttons/button';
import InlineSvg from './inlineSvg';

const DropdownButton = ({isOpen, children}) => {
  return (
    <StyledButton isOpen={isOpen}>
      <StyledChevronDown />
      {children}
    </StyledButton>
  );
};

DropdownButton.propTypes = {
  isOpen: PropTypes.bool,
};

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-right: 0.5em;
`;

const StyledButton = styled(props => <Button {...props} />)`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 1;
  box-shadow: none;

  &, &:hover { border-bottom-color: ${p =>
    p.isOpen ? 'transparent' : p.theme.borderDark};}
`;

export default DropdownButton;
