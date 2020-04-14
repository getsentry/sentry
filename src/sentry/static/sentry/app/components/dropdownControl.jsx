import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import DropdownBubble from 'app/components/dropdownBubble';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';

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
    // This makes the dropdown menu blend (e.g. corners are not rounded) with its
    // actor (opener) component
    blendWithActor: PropTypes.bool,
  };

  static defaultProps = {
    alwaysRenderMenu: true,
    menuWidth: '100%',
  };

  renderButton(isOpen, getActorProps) {
    const {label, button, buttonProps} = this.props;
    if (button) {
      return button({isOpen, getActorProps});
    }
    return (
      <StyledDropdownButton {...getActorProps(buttonProps)} isOpen={isOpen}>
        {label}
      </StyledDropdownButton>
    );
  }

  render() {
    const {
      children,
      alwaysRenderMenu,
      alignRight,
      menuOffset,
      menuWidth,
      blendWithActor,
    } = this.props;

    return (
      <Container>
        <DropdownMenu alwaysRenderMenu={alwaysRenderMenu}>
          {({isOpen, getMenuProps, getActorProps}) => (
            <React.Fragment>
              {this.renderButton(isOpen, getActorProps)}
              <MenuContainer
                {...getMenuProps()}
                alignMenu={alignRight ? 'right' : 'left'}
                width={menuWidth}
                menuOffset={menuOffset}
                isOpen={isOpen}
                blendCorner
                blendWithActor={blendWithActor}
              >
                {children}
              </MenuContainer>
            </React.Fragment>
          )}
        </DropdownMenu>
      </Container>
    );
  }
}

const Container = styled('div')`
  display: inline-block;
  position: relative;
`;

const StyledDropdownButton = styled(DropdownButton)`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
`;

const MenuContainer = styled(DropdownBubble.withComponent('ul'))`
  list-style: none;
  padding: 0;
  margin: 0;
  display: ${p => (p.isOpen ? 'block' : 'none')};
`;

const DropdownItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray2};
`;

export default DropdownControl;
export {DropdownItem};
