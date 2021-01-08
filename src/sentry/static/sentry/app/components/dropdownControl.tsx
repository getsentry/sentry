import React from 'react';
import styled from '@emotion/styled';

import DropdownBubble from 'app/components/dropdownBubble';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu, {GetActorPropsFn} from 'app/components/dropdownMenu';
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

type Props = DefaultProps & {
  /**
   * String or element for the button contents.
   */
  label?: React.ReactNode;
  /**
   * A closure that returns a styled button. Function will get {isOpen, getActorProps}
   * as arguments. Use this if you need to style/replace the dropdown button.
   */
  button?: (props: {isOpen: boolean; getActorProps: GetActorPropsFn}) => React.ReactNode;
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

  render() {
    const {
      children,
      alwaysRenderMenu,
      alignRight,
      menuWidth,
      blendWithActor,
      priority,
      className,
    } = this.props;
    const alignMenu = alignRight ? 'right' : 'left';

    return (
      <Container className={className}>
        <DropdownMenu alwaysRenderMenu={alwaysRenderMenu}>
          {({isOpen, getMenuProps, getActorProps}) => (
            <React.Fragment>
              {this.renderButton(isOpen, getActorProps)}
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

const Content = styled(DropdownBubble)<{priority: ButtonPriority; isOpen: boolean}>`
  display: ${p => (p.isOpen ? 'block' : 'none')};
  border-color: ${p => p.theme.button[p.priority || 'form'].border};
`;

const DropdownItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default DropdownControl;
export {DropdownItem};
