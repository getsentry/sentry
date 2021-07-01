import * as React from 'react';
import styled from '@emotion/styled';

import DropdownBubble from 'app/components/dropdownBubble';
import DropdownButton from 'app/components/dropdownButton';
import DropdownMenu, {GetActorPropsFn, GetMenuPropsFn} from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';

type ButtonPriority = React.ComponentProps<typeof DropdownButton>['priority'];

type DefaultProps = {
  /**
   * Should the menu contents always be rendered?  Defaults to true.
   * Set to false to have menu contents removed from the DOM on close.
   */
  alwaysRenderMenu: boolean;
  fullWidth: boolean;
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
  fullWidth: boolean;
  getActorProps: GetActorPropsFn;
};

type Props = DefaultProps & {
  children:
    | ((args: ChildrenArgs) => React.ReactElement)
    | React.ReactElement
    | Array<React.ReactElement>;
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
   * Tooltip to show on button when dropdown isn't open
   */
  buttonTooltipTitle?: string | null;
  /**
   * This makes the dropdown menu blend (e.g. corners are not rounded) with its
   * actor (opener) component
   */
  blendWithActor?: boolean;

  priority?: ButtonPriority;

  fullWidth?: boolean;

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
    fullWidth: false,
    menuWidth: '100%',
  };

  renderButton(isOpen: boolean, fullWidth: boolean, getActorProps: GetActorPropsFn) {
    const {label, button, buttonProps, buttonTooltipTitle, priority} = this.props;

    if (button) {
      return button({isOpen, fullWidth, getActorProps});
    }

    if (buttonTooltipTitle && !isOpen) {
      return (
        <Tooltip
          containerDisplayMode="inline-flex"
          position="top"
          title={buttonTooltipTitle}
        >
          <StyledDropdownButton
            priority={priority}
            {...getActorProps(buttonProps)}
            isOpen={isOpen}
            fullWidth={fullWidth}
          >
            {label}
          </StyledDropdownButton>
        </Tooltip>
      );
    }

    return (
      <StyledDropdownButton
        priority={priority}
        {...getActorProps(buttonProps)}
        isOpen={isOpen}
        fullWidth={fullWidth}
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
    const {alwaysRenderMenu, className, fullWidth} = this.props;

    return (
      <Container fullWidth={fullWidth} className={className}>
        <DropdownMenu alwaysRenderMenu={alwaysRenderMenu}>
          {({isOpen, getMenuProps, getActorProps}) => (
            <React.Fragment>
              {this.renderButton(isOpen, fullWidth, getActorProps)}
              {this.renderChildren(isOpen, getMenuProps)}
            </React.Fragment>
          )}
        </DropdownMenu>
      </Container>
    );
  }
}

const Container = styled('div')<{fullWidth: boolean}>`
  display: inline-block;
  position: relative;
  ${p => p.fullWidth && `width: 100%;`};
`;

const StyledDropdownButton = styled(DropdownButton)<{fullWidth: boolean}>`
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  white-space: nowrap;
  ${p =>
    p.fullWidth &&
    `width: 100%; justify-content: space-between !important; align-items: unset !important;`};
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
