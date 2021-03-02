import React from 'react';
import styled from '@emotion/styled';

import DropdownBubble from 'app/components/dropdownBubble';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu, {GetActorPropsFn, GetMenuPropsFn} from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';

type ButtonPriority = React.ComponentProps<typeof DropdownButton>['priority'];

type DefaultProps = {
  /**
   * Should the menu contents always be rendered?  Defaults to true.
   * Set to false to have menu contents removed from the DOM on close.
   */
  alwaysRenderMenu: boolean;
  /**
   * Width of the menu. Defaults to 100% of the button width.
   */
  menuWidth: string;
};

type ChildrenArgs = {
  isOpen: boolean;
  getMenuProps: GetMenuPropsFn;
};

type ButtonArgs = {
  isOpen: boolean;
  getActorProps: GetActorPropsFn;
};

type Props = DefaultProps & {
  children:
    | ((args: ChildrenArgs) => React.ReactElement)
    | React.ReactElement
    | Array<React.ReactNode>;
  /**
   * String or element for the button contents.
   */
  label?: React.ReactNode;
  /**
   * A closure that returns a styled button. Function will get {isOpen, getActorProps}
   * as arguments. Use this if you need to style/replace the dropdown button.
   */
  button?: (args: ButtonArgs) => React.ReactNode;
  /**
   * Align the dropdown menu to the right. (Default aligns to left)
   */
  alignRight?: boolean;
  /**
   * Props to pass to DropdownButton
   */
  buttonProps?: React.ComponentProps<typeof DropdownButton>;
  /**
   * This makes the dropdown menu blend (e.g. corners are not rounded) with its
   * actor (opener) component
   */
  blendWithActor?: boolean;

  priority?: ButtonPriority;

  className?: string;
};

/*
 * A higher level dropdown component that helps with building complete dropdowns
 * including the button + menu options. Use the `button` or `label` prop to set
 * the button content and `children` to provide menu options.
 */
class DropdownControl extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    alwaysRenderMenu: true,
    menuWidth: '100%',
  };

  renderButton(isOpen: boolean, getActorProps: GetActorPropsFn) {
    const {label, button, buttonProps, priority} = this.props;

    if (button) {
      return button({isOpen, getActorProps});
    }

    return (
      <StyledDropdownButton
        priority={priority}
        {...getActorProps(buttonProps)}
        isOpen={isOpen}
      >
        {label}
      </StyledDropdownButton>
    );
  }

  renderChildren(isOpen: boolean, getMenuProps: GetMenuPropsFn) {
    const {children, alignRight, menuWidth, blendWithActor, priority} = this.props;

    if (typeof children === 'function') {
      return children({isOpen, getMenuProps});
    }

    const alignMenu = alignRight ? 'right' : 'left';

    return (
      <Content
        {...getMenuProps()}
        priority={priority}
        alignMenu={alignMenu}
        width={menuWidth}
        isOpen={isOpen}
        blendWithActor={blendWithActor}
        blendCorner
      >
        {children}
      </Content>
    );
  }

  render() {
    const {alwaysRenderMenu, className} = this.props;

    return (
      <Container className={className}>
        <DropdownMenu alwaysRenderMenu={alwaysRenderMenu}>
          {({isOpen, getMenuProps, getActorProps}) => (
            <React.Fragment>
              {this.renderButton(isOpen, getActorProps)}
              {this.renderChildren(isOpen, getMenuProps)}
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

const Content = styled(DropdownBubble)<{isOpen: boolean; priority?: ButtonPriority}>`
  display: ${p => (p.isOpen ? 'block' : 'none')};
  border-color: ${p => p.theme.button[p.priority || 'form'].border};
`;

const DropdownItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default DropdownControl;
export {DropdownItem, Content};
