import {Component} from 'react';
import * as Sentry from '@sentry/react';

import {MENU_CLOSE_DELAY} from 'sentry/constants';

export type GetActorArgs<E extends Element> = {
  className?: string;
  onBlur?: (e: React.FocusEvent<E>) => void;
  onChange?: (e: React.ChangeEvent<E>) => void;
  onClick?: (e: React.MouseEvent<E>) => void;
  onFocus?: (e: React.FocusEvent<E>) => void;
  onKeyDown?: (e: React.KeyboardEvent<E>) => void;
  onMouseEnter?: (e: React.MouseEvent<E>) => void;
  onMouseLeave?: (e: React.MouseEvent<E>) => void;
  style?: React.CSSProperties;
};

export type GetMenuArgs<E extends Element> = {
  className?: string;
  onClick?: (e: React.MouseEvent<E>) => void;
  onKeyDown?: (event: React.KeyboardEvent<E>) => void;
  onMouseDown?: (e: React.MouseEvent<E>) => void;
  onMouseEnter?: (e: React.MouseEvent<E>) => void;
  onMouseLeave?: (e: React.MouseEvent<E>) => void;
};

// Props for the "actor" element of `<DropdownMenu>`
// This is the element that handles visibility of the dropdown menu
type ActorProps<E extends Element> = {
  onClick: (e: React.MouseEvent<E>) => void;
  onKeyDown: (e: React.KeyboardEvent<E>) => void;
  onMouseEnter: (e: React.MouseEvent<E>) => void;
  onMouseLeave: (e: React.MouseEvent<E>) => void;
};

type MenuProps<E extends Element> = {
  onClick: (e: React.MouseEvent<E>) => void;
  onMouseEnter: (e: React.MouseEvent<E>) => void;
  onMouseLeave: (e: React.MouseEvent<E>) => void;
  role: string;
};

export type GetActorPropsFn = <E extends Element = Element>(
  opts?: GetActorArgs<E>
) => ActorProps<E>;

export type GetMenuPropsFn = <E extends Element = Element>(
  opts?: GetMenuArgs<E>
) => MenuProps<E>;

export type MenuActions = {
  close: (event?: React.MouseEvent) => void;
  open: (event?: React.MouseEvent) => void;
};

type RenderProps = {
  actions: MenuActions;
  getActorProps: GetActorPropsFn;
  getMenuProps: GetMenuPropsFn;
  getRootProps: (props?: Record<string, unknown>) => Record<string, unknown> | undefined;
  isOpen: boolean;
};

type DefaultProps = {
  /**
   * closes menu on "Esc" keypress
   */
  closeOnEscape: boolean;
  /**
   * Keeps dropdown menu open when menu is clicked
   */
  keepMenuOpen: boolean;
};

type Props = DefaultProps & {
  /**
   * Render function
   */
  children: (renderProps: RenderProps) => React.ReactNode;
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
   * If this is set, then this will become a "controlled" component.
   * It will no longer set local state and dropdown visibility will
   * only follow `isOpen`.
   */
  isOpen?: boolean;
  /**
   * Callback for when we get a click outside of dropdown menus.
   * Useful for when menu is controlled.
   */
  onClickOutside?: (e: MouseEvent) => void;
  onClose?: (e: React.KeyboardEvent | React.MouseEvent | undefined) => void;
  onOpen?: (e: React.MouseEvent | undefined) => void;
  /**
   * Callback function to check if we should ignore click outside to
   * hide dropdown menu
   */
  shouldIgnoreClickOutside?: (event: MouseEvent) => boolean;
};

type State = {
  isOpen: boolean;
};

/**
 * Deprecated dropdown menu. Use these alternatives instead:
 *
 * - For a select menu: use `CompactSelect`
 * https://storybook.sentry.dev/?path=/story/components-forms-fields--compact-select-field
 *
 * - For an action menu (where there's no selection state, clicking on a menu
 * item will trigger an action): use `DropdownMenuControl`.
 *
 * - For for other menus/overlays: use a combination of `Overlay` and the
 * `useOverlay` hook.
 * https://storybook.sentry.dev/?path=/story/components-buttons-dropdowns-overlay--overlay
 *
 * @deprecated
 */
class DropdownMenu extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    keepMenuOpen: false,
    closeOnEscape: true,
  };

  state: State = {
    isOpen: false,
  };

  componentWillUnmount() {
    window.clearTimeout(this.mouseLeaveTimeout);
    window.clearTimeout(this.mouseEnterTimeout);
    document.removeEventListener('click', this.checkClickOutside, true);
  }

  dropdownMenu: Element | null = null;
  dropdownActor: Element | null = null;

  mouseLeaveTimeout: number | undefined = undefined;
  mouseEnterTimeout: number | undefined = undefined;

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

    if (!this.dropdownMenu || !this.isOpen()) {
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
        scope.setLevel('warning');
        Sentry.captureException(new Error('DropdownMenu does not have "Actor" attached'));
      });
    }

    // Button that controls visibility of dropdown menu
    if (this.dropdownActor?.contains(e.target)) {
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
    await new Promise(resolve => window.setTimeout(resolve));

    this.handleClose();
  };

  // Opens dropdown menu
  handleOpen = (e?: React.MouseEvent<Element>) => {
    const {onOpen, isOpen, alwaysRenderMenu, isNestedDropdown} = this.props;
    const isControlled = typeof isOpen !== 'undefined';
    if (!isControlled) {
      this.setState({
        isOpen: true,
      });
    }

    window.clearTimeout(this.mouseLeaveTimeout);

    // If we always render menu (e.g. DropdownLink), then add the check click outside handlers when we open the menu
    // instead of when the menu component mounts. Otherwise we will have many click handlers attached on initial load.
    if (alwaysRenderMenu || isNestedDropdown) {
      document.addEventListener('click', this.checkClickOutside, true);
    }

    if (typeof onOpen === 'function') {
      onOpen(e);
    }
  };

  // Decide whether dropdown should be closed when mouse leaves element
  // Only for nested dropdowns
  handleMouseLeave = (e: React.MouseEvent<Element>) => {
    if (!this.props.isNestedDropdown) {
      return;
    }

    const toElement = e.relatedTarget;

    try {
      if (
        this.dropdownMenu &&
        (!(toElement instanceof Element) || !this.dropdownMenu.contains(toElement))
      ) {
        window.clearTimeout(this.mouseLeaveTimeout);
        this.mouseLeaveTimeout = window.setTimeout(() => {
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
  handleClose = (e?: React.KeyboardEvent<Element> | React.MouseEvent<Element>) => {
    const {onClose, isOpen, alwaysRenderMenu, isNestedDropdown} = this.props;
    const isControlled = typeof isOpen !== 'undefined';

    if (!isControlled) {
      this.setState({isOpen: false});
    }

    // Clean up click handlers when the menu is closed for menus that are always rendered,
    // otherwise the click handlers get cleaned up when menu is unmounted
    if (alwaysRenderMenu || isNestedDropdown) {
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
    const {alwaysRenderMenu, isNestedDropdown} = this.props;

    this.dropdownMenu = ref;

    // Don't add document event listeners here if we are always rendering menu
    // Instead add when menu is opened
    if (alwaysRenderMenu || isNestedDropdown) {
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

  getRootProps(props?: Record<string, unknown>) {
    return props;
  }

  // Actor is the component that will open the dropdown menu
  getActorProps: GetActorPropsFn = <E extends Element = Element>({
    onClick,
    onMouseEnter,
    onMouseLeave,
    onKeyDown,
    style = {},
    ...props
  }: GetActorArgs<E> = {}) => {
    const {isNestedDropdown, closeOnEscape} = this.props;

    const refProps = {ref: this.handleActorMount};

    // Props that the actor needs to have <DropdownMenu> work
    return {
      ...props,
      ...refProps,
      style: {...style, outline: 'none'},
      'aria-expanded': this.isOpen(),
      'aria-haspopup': 'listbox',

      onKeyDown: (e: React.KeyboardEvent<E>) => {
        if (typeof onKeyDown === 'function') {
          onKeyDown(e);
        }

        if (e.key === 'Escape' && closeOnEscape) {
          this.handleClose(e);
        }
      },

      onMouseEnter: (e: React.MouseEvent<E>) => {
        if (typeof onMouseEnter === 'function') {
          onMouseEnter(e);
        }

        // Only handle mouse enter for nested dropdowns
        if (!isNestedDropdown) {
          return;
        }

        window.clearTimeout(this.mouseEnterTimeout);
        window.clearTimeout(this.mouseLeaveTimeout);

        this.mouseEnterTimeout = window.setTimeout(() => {
          this.handleOpen(e);
        }, MENU_CLOSE_DELAY);
      },

      onMouseLeave: (e: React.MouseEvent<E>) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(e);
        }

        window.clearTimeout(this.mouseEnterTimeout);
        window.clearTimeout(this.mouseLeaveTimeout);

        this.handleMouseLeave(e);
      },

      onClick: (e: React.MouseEvent<E>) => {
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
  getMenuProps: GetMenuPropsFn = <E extends Element = Element>({
    onClick,
    onMouseLeave,
    onMouseEnter,
    ...props
  }: GetMenuArgs<E> = {}): MenuProps<E> => {
    const refProps = {ref: this.handleMenuMount};

    // Props that the menu needs to have <DropdownMenu> work
    return {
      ...props,
      ...refProps,
      role: 'listbox',
      onMouseEnter: (e: React.MouseEvent<E>) => {
        onMouseEnter?.(e);

        // There is a delay before closing a menu on mouse leave, cancel this
        // action if mouse enters menu again
        window.clearTimeout(this.mouseLeaveTimeout);
      },
      onMouseLeave: (e: React.MouseEvent<E>) => {
        onMouseLeave?.(e);
        this.handleMouseLeave(e);
      },
      onClick: (e: React.MouseEvent<E>) => {
        this.handleDropdownMenuClick(e);
        onClick?.(e);
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
