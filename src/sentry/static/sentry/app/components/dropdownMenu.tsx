import PropTypes from 'prop-types';
import React from 'react';
import * as Sentry from '@sentry/react';

import {MENU_CLOSE_DELAY} from 'app/constants';

type GetActorArgs = {
  onClick?: (e: React.MouseEvent<Element>) => void;
  onMouseEnter?: (e: React.MouseEvent<Element>) => void;
  onMouseLeave?: (e: React.MouseEvent<Element>) => void;
  onKeyDown?: (e: React.KeyboardEvent<Element>) => void;
  style?: React.CSSProperties;
  className?: string;
};

type GetMenuArgs = {
  onClick?: (e: React.MouseEvent<Element>) => void;
  onMouseEnter?: (e: React.MouseEvent<Element>) => void;
  onMouseLeave?: (e: React.MouseEvent<Element>) => void;
  className?: string;
};

// Props for the "actor" element of `<DropdownMenu>`
// This is the element that handles visibility of the dropdown menu
type ActorProps = {
  onClick: (e: React.MouseEvent<Element>) => void;
  onMouseEnter: (e: React.MouseEvent<Element>) => void;
  onMouseLeave: (e: React.MouseEvent<Element>) => void;
  onKeyDown: (e: React.KeyboardEvent<Element>) => void;
};

type MenuProps = {
  onClick: (e: React.MouseEvent<Element>) => void;
  onMouseEnter: (e: React.MouseEvent<Element>) => void;
  onMouseLeave: (e: React.MouseEvent<Element>) => void;
};

export type GetActorPropsFn = (opts?: GetActorArgs) => ActorProps;
type GetMenuPropsFn = (opts?: GetMenuArgs) => MenuProps;

type RenderProps = {
  isOpen: boolean;
  getRootProps: Function;
  getActorProps: GetActorPropsFn;
  getMenuProps: GetMenuPropsFn;
  actions: {
    open: Function;
    close: Function;
  };
};

type DefaultProps = {
  /**
   * Keeps dropdown menu open when menu is clicked
   */
  keepMenuOpen: boolean;
  /**
   * closes menu on "Esc" keypress
   */
  closeOnEscape: boolean;
};

type Props = DefaultProps & {
  onOpen?: Function;
  onClose?: Function;
  /**
   * Callback for when we get a click outside of dropdown menus.
   * Useful for when menu is controlled.
   */
  onClickOutside?: Function;
  /**
   * Callback function to check if we should ignore click outside to
   * hide dropdown menu
   */
  shouldIgnoreClickOutside?: (event: MouseEvent) => boolean;
  /**
   * If this is set, then this will become a "controlled" component.
   * It will no longer set local state and dropdown visibility will
   * only follow `isOpen`.
   */
  isOpen?: boolean;
  /**
   * Compatibility for <DropdownLink>
   * This will change where we attach event handlers
   */
  alwaysRenderMenu?: boolean;
  /**
   * If this is set to true, the dropdown behaves as a "nested dropdown" and is
   * triggered on mouse enter and mouse leave
   */
  isNestedDropdown?: boolean;
  /**
   * Render function
   */
  children: (renderProps: RenderProps) => React.ReactNode;
};

type State = {
  isOpen: boolean;
};

class DropdownMenu extends React.Component<Props, State> {
  static propTypes = {
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    onClickOutside: PropTypes.func,
    shouldIgnoreClickOutside: PropTypes.func,
    isOpen: PropTypes.bool,
    keepMenuOpen: PropTypes.bool,
    alwaysRenderMenu: PropTypes.bool,
    closeOnEscape: PropTypes.bool,
    isNestedDropdown: PropTypes.bool,
  };

  static defaultProps: DefaultProps = {
    keepMenuOpen: false,
    closeOnEscape: true,
  };

  state: State = {
    isOpen: false,
  };

  componentWillUnmount() {
    document.removeEventListener('click', this.checkClickOutside, true);
  }

  dropdownMenu: Element | null = null;
  dropdownActor: Element | null = null;

  mouseLeaveId: number | null = null;
  mouseEnterId: number | null = null;

  // Gets open state from props or local state when appropriate
  isOpen = () => {
    const {isOpen} = this.props;
    const isControlled = typeof isOpen !== 'undefined';
    return (isControlled && isOpen) || this.state.isOpen;
  };

  // Checks if click happens inside of dropdown menu (or its button)
  // Closes dropdownmenu if it is "outside"
  checkClickOutside = async (e: MouseEvent) => {
    const {onClickOutside, shouldIgnoreClickOutside} = this.props;

    if (!this.dropdownMenu) {
      return;
    }

    if (!(e.target instanceof Element)) {
      return;
    }

    // Dropdown menu itself
    if (this.dropdownMenu.contains(e.target)) {
      return;
    }

    if (!this.dropdownActor) {
      // Log an error, should be lower priority
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('DropdownMenu does not have "Actor" attached'));
      });
    }

    // Button that controls visibility of dropdown menu
    if (this.dropdownActor && this.dropdownActor.contains(e.target)) {
      return;
    }

    if (typeof shouldIgnoreClickOutside === 'function' && shouldIgnoreClickOutside(e)) {
      return;
    }

    if (typeof onClickOutside === 'function') {
      onClickOutside(e);
    }

    // Wait until the current macrotask completes, in the case that the click
    // happened on a hovercard or some other element rendered outside of the
    // dropdown, but controlled by the existence of the dropdown, we need to
    // ensure any click handlers are run.
    await new Promise(resolve => setTimeout(resolve));

    this.handleClose(null);
  };

  // Opens dropdown menu
  handleOpen = (e: React.MouseEvent<Element>) => {
    const {onOpen, isOpen, alwaysRenderMenu} = this.props;
    const isControlled = typeof isOpen !== 'undefined';
    if (!isControlled) {
      this.setState({
        isOpen: true,
      });
    }

    if (this.mouseLeaveId) {
      window.clearTimeout(this.mouseLeaveId);
    }

    // If we always render menu (e.g. DropdownLink), then add the check click outside handlers when we open the menu
    // instead of when the menu component mounts. Otherwise we will have many click handlers attached on initial load.
    if (alwaysRenderMenu) {
      document.addEventListener('click', this.checkClickOutside, true);
    }

    if (typeof onOpen === 'function') {
      onOpen(e);
    }
  };

  // Decide whether dropdown should be closed when mouse leaves element
  // Only for nested dropdowns
  handleMouseLeave = (e: React.MouseEvent<Element>) => {
    const {isNestedDropdown} = this.props;
    if (!isNestedDropdown) {
      return;
    }

    const toElement = e.relatedTarget;

    try {
      if (
        this.dropdownMenu &&
        (!(toElement instanceof Element) || !this.dropdownMenu.contains(toElement))
      ) {
        this.mouseLeaveId = window.setTimeout(() => {
          this.handleClose(e);
        }, MENU_CLOSE_DELAY);
      }
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setExtra('event', e);
        scope.setExtra('relatedTarget', e.relatedTarget);
        Sentry.captureException(err);
      });
    }
  };

  // Closes dropdown menu
  handleClose = (e: React.KeyboardEvent<Element> | React.MouseEvent<Element> | null) => {
    const {onClose, isOpen, alwaysRenderMenu} = this.props;
    const isControlled = typeof isOpen !== 'undefined';

    if (!isControlled) {
      this.setState({isOpen: false});
    }

    // Clean up click handlers when the menu is closed for menus that are always rendered,
    // otherwise the click handlers get cleaned up when menu is unmounted
    if (alwaysRenderMenu) {
      document.removeEventListener('click', this.checkClickOutside, true);
    }

    if (typeof onClose === 'function') {
      onClose(e);
    }
  };

  // When dropdown menu is displayed and mounted to DOM,
  // bind a click handler to `document` to listen for clicks outside of
  // this component and close menu if so
  handleMenuMount = (ref: Element | null) => {
    if (ref && !(ref instanceof Element)) {
      return;
    }
    const {alwaysRenderMenu} = this.props;

    this.dropdownMenu = ref;

    // Don't add document event listeners here if we are always rendering menu
    // Instead add when menu is opened
    if (alwaysRenderMenu) {
      return;
    }

    if (this.dropdownMenu) {
      // 3rd arg = useCapture = so event capturing vs event bubbling
      document.addEventListener('click', this.checkClickOutside, true);
    } else {
      document.removeEventListener('click', this.checkClickOutside, true);
    }
  };

  handleActorMount = (ref: Element | null) => {
    if (ref && !(ref instanceof Element)) {
      return;
    }
    this.dropdownActor = ref;
  };

  handleToggle = (e: React.MouseEvent<Element>) => {
    if (this.isOpen()) {
      this.handleClose(e);
    } else {
      this.handleOpen(e);
    }
  };

  // Control whether we should hide dropdown menu when it is clicked
  handleDropdownMenuClick = (e: React.MouseEvent<Element>) => {
    if (this.props.keepMenuOpen) {
      return;
    }

    this.handleClose(e);
  };

  getRootProps<T>(props: T): T {
    return props;
  }

  // Actor is the component that will open the dropdown menu
  getActorProps: GetActorPropsFn = ({
    onClick,
    onMouseEnter,
    onMouseLeave,
    onKeyDown,
    style = {},
    ...props
  }: GetActorArgs = {}) => {
    const {isNestedDropdown, closeOnEscape} = this.props;

    const refProps = {ref: this.handleActorMount};

    // Props that the actor needs to have <DropdownMenu> work
    return {
      ...props,
      ...refProps,
      style: {...style, outline: 'none'},

      onKeyDown: (e: React.KeyboardEvent<Element>) => {
        if (typeof onKeyDown === 'function') {
          onKeyDown(e);
        }

        if (e.key === 'Escape' && closeOnEscape) {
          this.handleClose(e);
        }
      },

      onMouseEnter: (e: React.MouseEvent<Element>) => {
        if (typeof onMouseEnter === 'function') {
          onMouseEnter(e);
        }

        // Only handle mouse enter for nested dropdowns
        if (!isNestedDropdown) {
          return;
        }

        if (this.mouseLeaveId) {
          window.clearTimeout(this.mouseLeaveId);
        }

        this.mouseEnterId = window.setTimeout(() => {
          this.handleOpen(e);
        }, MENU_CLOSE_DELAY);
      },

      onMouseLeave: (e: React.MouseEvent<Element>) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(e);
        }

        if (this.mouseEnterId) {
          window.clearTimeout(this.mouseEnterId);
        }
        this.handleMouseLeave(e);
      },

      onClick: (e: React.MouseEvent<Element>) => {
        // If we are a nested dropdown, clicking the actor
        // should be a no-op so that the menu doesn't close.
        if (isNestedDropdown) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        this.handleToggle(e);

        if (typeof onClick === 'function') {
          onClick(e);
        }
      },
    };
  };

  // Menu is the menu component that <DropdownMenu> will control
  getMenuProps: GetMenuPropsFn = ({
    onClick,
    onMouseLeave,
    onMouseEnter,
    ...props
  }: GetMenuArgs = {}): MenuProps => {
    const refProps = {ref: this.handleMenuMount};

    // Props that the menu needs to have <DropdownMenu> work
    return {
      ...props,
      ...refProps,
      onMouseEnter: (e: React.MouseEvent<Element>) => {
        if (typeof onMouseEnter === 'function') {
          onMouseEnter(e);
        }

        // There is a delay before closing a menu on mouse leave, cancel this action if mouse enters menu again
        if (this.mouseLeaveId) {
          window.clearTimeout(this.mouseLeaveId);
        }
      },
      onMouseLeave: (e: React.MouseEvent<Element>) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(e);
        }

        this.handleMouseLeave(e);
      },
      onClick: (e: React.MouseEvent<Element>) => {
        this.handleDropdownMenuClick(e);

        if (typeof onClick === 'function') {
          onClick(e);
        }
      },
    };
  };

  render() {
    const {children} = this.props;

    // Default anchor = left
    const shouldShowDropdown = this.isOpen();

    return children({
      isOpen: shouldShowDropdown,
      getRootProps: this.getRootProps,
      getActorProps: this.getActorProps,
      getMenuProps: this.getMenuProps,
      actions: {
        open: this.handleOpen,
        close: this.handleClose,
      },
    });
  }
}

export default DropdownMenu;
