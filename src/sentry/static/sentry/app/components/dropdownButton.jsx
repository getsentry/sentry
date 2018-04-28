import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import Button from 'app/components/buttons/button';
import InlineSvg from 'app/components/inlineSvg';

const DropdownButton = ({isOpen, children, ...props}) => {
  return (
    <StyledButton isOpen={isOpen} {...props}>
      {children}
      <StyledChevronDown />
    </StyledButton>
  );
};

DropdownButton.displayName = 'DropdownButton';
DropdownButton.propTypes = {
  isOpen: PropTypes.bool,
};

const StyledChevronDown = styled(props => (
  <InlineSvg src="icon-chevron-down" {...props} />
))`
  margin-left: 0.33em;
`;

const StyledButton = styled(({isOpen, ...props}) => <Button {...props} />)`
  border-bottom-right-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  border-bottom-left-radius: ${p => (p.isOpen ? 0 : p.theme.borderRadius)};
  position: relative;
  z-index: 2;
  box-shadow: ${p => (p.isOpen ? 'none' : p.theme.dropShadowLight)};

  &,
  &:hover {
    border-bottom-color: ${p => (p.isOpen ? 'transparent' : p.theme.borderDark)};
  }
`;

export default DropdownButton;
