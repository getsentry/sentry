import PropTypes from 'prop-types';
import React from 'react';

import styled from 'react-emotion';
import DropdownButton from 'app/components/dropdownButton';
import MenuItem from 'app/components/menuItem';
import DropdownMenu from 'app/components/dropdownMenu';
import space from 'app/styles/space';

/*
 * A higher level dropdown component that helps with building complete dropdowns
 * including the button + menu options. Use the `button` or `label` prop to set
 * the button content and `children` to provide menu options.
 */
class DropdownControl extends React.Component {
  static propTypes = {
    // String or element for the button contents.
    label: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
    // A closure that returns a styled button. Function will get {isOpen, getActorProps}
    // as arguments. Use this if you need to style/replace the dropdown button.
    button: PropTypes.func,
    // Width of the menu. Defaults to 100% of the button width.
    menuWidth: PropTypes.string,
    // Height offset for the menu. Defaults to 39px as standard buttons are
    // 40px tall
    menuOffset: PropTypes.string,
    // Should the menu contents always be rendered?  Defaults to true.
    // Set to false to have menu contents removed from the DOM on close.
    alwaysRenderMenu: PropTypes.bool,
    // Align the dropdown menu to the right. (Default aligns to left)
    alignRight: PropTypes.bool,
    // Props to pass to DropdownButton
    buttonProps: PropTypes.object,
  };

  static defaultProps = {
    menuOffset: '39px',
    alwaysRenderMenu: true,
    menuWidth: '100%',
  };

  renderButton(isOpen, getActorProps) {
    const {label, button, buttonProps} = this.props;
    if (button) {
      return button({isOpen, getActorProps});
    }
    return (
      <StyledDropdownButton
        {...getActorProps({...buttonProps, isStyled: true})}
        isOpen={isOpen}
      >
        {label}
      </StyledDropdownButton>
    );
  }

  render() {
    const {children, alwaysRenderMenu, alignRight, menuOffset, menuWidth} = this.props;

    return (
      <Container>
        <DropdownMenu alwaysRenderMenu={alwaysRenderMenu}>
          {({isOpen, getMenuProps, getActorProps}) => {
            return (
              <React.Fragment>
                {this.renderButton(isOpen, getActorProps)}
                <MenuContainer
                  {...getMenuProps({isStyled: true})}
                  alignRight={alignRight}
                  menuWidth={menuWidth}
                  menuOffset={menuOffset}
                  isOpen={isOpen}
                >
                  {children}
                </MenuContainer>
              </React.Fragment>
            );
          }}
        </DropdownMenu>
      </Container>
    );
  }
}

const Container = styled('div')`
  display: inline-block;
  position: relative;
`;

const StyledDropdownButton = styled(
  React.forwardRef((prop, ref) => <DropdownButton innerRef={ref} {...prop} />)
)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
  font-weight: normal;
`;

const MenuContainer = styled('ul')`
  list-style: none;
  width: ${p => p.menuWidth};

  position: absolute;
  top: ${p => p.menuOffset};
  ${p => p.alignRight && 'right: 0'};
  padding: 0;
  margin: 0;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.menu};

  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadiusBottom};
  box-shadow: ${p => p.theme.dropShadowLight};
  border: 1px solid ${p => p.theme.borderDark};
  overflow: hidden;

  display: ${p => (p.isOpen ? 'block' : 'none')};
`;

const DropdownItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray2};

  & a {
    color: ${p => p.theme.foreground};
    display: block;
    padding: ${space(0.5)} ${space(2)};
  }
  & a:hover {
    background: ${p => p.theme.offWhite};
  }
  &.active a,
  &.active a:hover {
    color: ${p => p.theme.white};
    background: ${p => p.theme.purple};
  }
`;

export default DropdownControl;
export {DropdownItem};
