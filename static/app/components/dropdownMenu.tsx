import * as React from 'react';
import {useEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';

import {MENU_CLOSE_DELAY} from 'sentry/constants';

export type GetActorArgs<E extends Element> = {
  onClick?: (e: React.MouseEvent<E>) => void;
  onMouseEnter?: (e: React.MouseEvent<E>) => void;
  onMouseLeave?: (e: React.MouseEvent<E>) => void;
  onKeyDown?: (e: React.KeyboardEvent<E>) => void;
  onFocus?: (e: React.FocusEvent<E>) => void;
  onBlur?: (e: React.FocusEvent<E>) => void;
  onChange?: (e: React.ChangeEvent<E>) => void;
  style?: React.CSSProperties;
  className?: string;
};

export type GetMenuArgs<E extends Element> = {
  onClick?: (e: React.MouseEvent<E>) => void;
  onMouseEnter?: (e: React.MouseEvent<E>) => void;
  onMouseLeave?: (e: React.MouseEvent<E>) => void;
  onMouseDown?: (e: React.MouseEvent<E>) => void;
  onKeyDown?: (event: React.KeyboardEvent<E>) => void;
  className?: string;
  itemCount?: number;
};

/**
 * Props for the "actor" element of `<DropdownMenu>`
 * This is the element that handles visibility of the dropdown menu
 */
type ActorProps<E extends Element> = {
  onClick: (e: React.MouseEvent<E>) => void;
  onMouseEnter: (e: React.MouseEvent<E>) => void;
  onMouseLeave: (e: React.MouseEvent<E>) => void;
  onKeyDown: (e: React.KeyboardEvent<E>) => void;
};

type MenuProps<E extends Element> = {
  onClick: (e: React.MouseEvent<E>) => void;
  onMouseEnter: (e: React.MouseEvent<E>) => void;
  onMouseLeave: (e: React.MouseEvent<E>) => void;
};

export type GetActorPropsFn = <E extends Element = Element>(
  opts?: GetActorArgs<E>
) => ActorProps<E>;

export type GetMenuPropsFn = <E extends Element = Element>(
  opts?: GetMenuArgs<E>
) => MenuProps<E>;

type RenderProps = {
  isOpen: boolean;
  getRootProps: Function;
  getActorProps: GetActorPropsFn;
  getMenuProps: GetMenuPropsFn;
  actions: {
    open: (event?: React.MouseEvent<Element>) => void;
    close: (event?: React.MouseEvent<Element>) => void;
  };
};

type Props = {
  /**
   * Keeps dropdown menu open when menu is clicked
   */
  keepMenuOpen: boolean;
  /**
   * closes menu on "Esc" keypress
   */
  closeOnEscape: boolean;
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

function DropdownMenu({
  keepMenuOpen = false,
  closeOnEscape = true,
  onOpen,
  onClose,
  onClickOutside,
  shouldIgnoreClickOutside,
  isOpen: isOpenProp,
  alwaysRenderMenu,
  isNestedDropdown,
  children,
}: Props) {
  const dropdownMenu = useRef<Element | null>(null);
  const dropdownActor = useRef<Element | null>(null);

  let mouseLeaveId: number | null = null;
  let mouseEnterId: number | null = null;

  /**
   * Internal isOpen state, separate from isOpenProp. This is used when
   * component is not controlled, i.e. there is no isOpenProp passed
   */
  const [isOpenInternalState, setIsOpenInternalState] = useState(false);
  /**
   * Combined isOpen state, set to isOpenProp if component
   * is controlled, or to isOpenState otherwise
   */
  const [isOpen, setIsOpen] = useState(false);
  /**
   * Parallel ref to isOpen (should always be equal to the isOpen state),
   * to access isOpen state from event listeners, like checkClickOutside.
   */
  const isOpenRef = useRef(false);
  useEffect(() => {
    const newIsOpen = isOpenProp ?? isOpenInternalState;
    setIsOpen(newIsOpen);
    isOpenRef.current = newIsOpen;
  }, [isOpenProp, isOpenInternalState]);

  /**
   * Checks if click happens inside of dropdown menu (or its button)
   * Closes dropdownmenu if it is "outside"
   */
  const checkClickOutside = async (e: MouseEvent) => {
    if (!dropdownMenu.current || !isOpenRef.current) {
      return;
    }

    if (!(e.target instanceof Element)) {
      return;
    }

    // Dropdown menu itself
    if (dropdownMenu.current?.contains(e.target)) {
      return;
    }

    if (!dropdownActor.current) {
      // Log an error, should be lower priority
      Sentry.withScope(scope => {
        scope.setLevel(Sentry.Severity.Warning);
        Sentry.captureException(new Error('DropdownMenu does not have "Actor" attached'));
      });
    }

    // Button that controls visibility of dropdown menu
    if (dropdownActor.current?.contains(e.target)) {
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
    handleClose();
  };

  /**
   * Opens dropdown menu
   */
  const handleOpen = (e?: React.MouseEvent<Element>) => {
    const isControlled = typeof isOpenProp !== 'undefined';

    if (!isControlled) {
      setIsOpenInternalState(true);
    }

    if (mouseLeaveId) {
      window.clearTimeout(mouseLeaveId);
    }

    // If we always render menu (e.g. DropdownLink), then add the check click outside handlers when we open the menu
    // instead of when the menu component mounts. Otherwise we will have many click handlers attached on initial load.
    if (alwaysRenderMenu || isNestedDropdown) {
      document.addEventListener('click', checkClickOutside, true);
    }

    if (typeof onOpen === 'function') {
      onOpen(e);
    }
  };

  /**
   * Decide whether dropdown should be closed when mouse leaves element
   * Only for nested dropdowns
   */
  const handleMouseLeave = (e: React.MouseEvent<Element>) => {
    if (!isNestedDropdown) {
      return;
    }

    const toElement = e.relatedTarget;

    try {
      if (!(toElement instanceof Element) || !dropdownMenu.current?.contains(toElement)) {
        mouseLeaveId = window.setTimeout(() => {
          handleClose(e);
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

  /**
   * Closes dropdown menu
   */
  const handleClose = (e?: React.KeyboardEvent<Element> | React.MouseEvent<Element>) => {
    const isControlled = typeof isOpenProp !== 'undefined';

    if (!isControlled) {
      setIsOpenInternalState(false);
    }

    // Clean up click handlers when the menu is closed for menus that are always rendered,
    // otherwise the click handlers get cleaned up when menu is unmounted
    if (alwaysRenderMenu || isNestedDropdown) {
      document.removeEventListener('click', checkClickOutside, true);
    }

    if (typeof onClose === 'function') {
      onClose(e);
    }
  };

  /**
   * When dropdown menu is displayed and mounted to DOM,
   * bind a click handler to `document` to listen for clicks outside of
   * this component and close menu if so
   */
  const handleMenuMount = (ref: Element | null) => {
    if (ref && !(ref instanceof Element)) {
      return;
    }

    dropdownMenu.current = ref;

    // Don't add document event listeners here if we are always rendering menu
    // Instead add when menu is opened
    if (alwaysRenderMenu || isNestedDropdown) {
      return;
    }

    if (dropdownMenu.current) {
      // 3rd arg = useCapture = so event capturing vs event bubbling
      document.addEventListener('click', checkClickOutside, true);
    } else {
      document.removeEventListener('click', checkClickOutside, true);
    }
  };

  const handleActorMount = (ref: Element | null) => {
    if (ref && !(ref instanceof Element)) {
      return;
    }
    dropdownActor.current = ref;
  };

  const handleToggle = (e: React.MouseEvent<Element>) => {
    if (isOpenRef.current) {
      handleClose(e);
    } else {
      handleOpen(e);
    }
  };

  /**
   * Control whether we should hide dropdown menu when it is clicked
   */
  const handleDropdownMenuClick = (e: React.MouseEvent<Element>) => {
    if (keepMenuOpen) {
      return;
    }

    handleClose(e);
  };

  const getRootProps = <T extends unknown>(props: T): T => props;

  /**
   * Actor is the component that will open the dropdown menu
   */
  const getActorProps: GetActorPropsFn = <E extends Element = Element>({
    onClick,
    onMouseEnter,
    onMouseLeave,
    onKeyDown,
    style = {},
    ...props
  }: GetActorArgs<E> = {}) => {
    const refProps = {ref: handleActorMount};

    // Props that the actor needs to have <DropdownMenu> work
    return {
      ...props,
      ...refProps,
      style: {...style, outline: 'none'},

      onKeyDown: (e: React.KeyboardEvent<E>) => {
        if (typeof onKeyDown === 'function') {
          onKeyDown(e);
        }

        if (e.key === 'Escape' && closeOnEscape) {
          handleClose(e);
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

        if (mouseLeaveId) {
          window.clearTimeout(mouseLeaveId);
        }

        mouseEnterId = window.setTimeout(() => {
          handleOpen(e);
        }, MENU_CLOSE_DELAY);
      },

      onMouseLeave: (e: React.MouseEvent<E>) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(e);
        }

        if (mouseEnterId) {
          window.clearTimeout(mouseEnterId);
        }
        handleMouseLeave(e);
      },

      onClick: (e: React.MouseEvent<E>) => {
        // If we are a nested dropdown, clicking the actor
        // should be a no-op so that the menu doesn't close.
        if (isNestedDropdown) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        handleToggle(e);

        if (typeof onClick === 'function') {
          onClick(e);
        }
      },
    };
  };

  /**
   * Menu is the menu component that <DropdownMenu> will control
   */
  const getMenuProps: GetMenuPropsFn = <E extends Element = Element>({
    onClick,
    onMouseLeave,
    onMouseEnter,
    ...props
  }: GetMenuArgs<E> = {}): MenuProps<E> => {
    const refProps = {ref: handleMenuMount};

    // Props that the menu needs to have <DropdownMenu> work
    return {
      ...props,
      ...refProps,
      onMouseEnter: (e: React.MouseEvent<E>) => {
        if (typeof onMouseEnter === 'function') {
          onMouseEnter(e);
        }

        // There is a delay before closing a menu on mouse leave, cancel this action if mouse enters menu again
        if (mouseLeaveId) {
          window.clearTimeout(mouseLeaveId);
        }
      },
      onMouseLeave: (e: React.MouseEvent<E>) => {
        if (typeof onMouseLeave === 'function') {
          onMouseLeave(e);
        }

        handleMouseLeave(e);
      },
      onClick: (e: React.MouseEvent<E>) => {
        handleDropdownMenuClick(e);

        if (typeof onClick === 'function') {
          onClick(e);
        }
      },
    };
  };

  // Remove checkClickOutside when component unmounts
  useEffect(() => {
    return () => document.removeEventListener('click', checkClickOutside, true);
  }, []);

  return children({
    isOpen,
    getRootProps,
    getActorProps,
    getMenuProps,
    actions: {
      open: handleOpen,
      close: handleClose,
    },
  });
}

export default DropdownMenu;
