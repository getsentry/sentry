import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {mergeProps} from '@react-aria/utils';
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

type GetMenuPropsFn = <E extends Element = Element>(
  opts?: GetMenuArgs<E>
) => MenuProps<E>;

type MenuActions = {
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

export interface DeprecatedDropdownMenuProps {
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
   * closes menu on "Esc" keypress
   * @default true
   */
  closeOnEscape?: boolean;
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
}

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
function DropdownMenu({
  closeOnEscape = true,
  children,
  alwaysRenderMenu,
  isNestedDropdown,
  isOpen: isOpenProp,
  onClickOutside,
  onClose,
  onOpen,
}: DeprecatedDropdownMenuProps) {
  const [isOpenState, setIsOpenState] = useState(false);

  const dropdownMenu = useRef<Element | null>(null);
  const dropdownActor = useRef<Element | null>(null);
  const mouseLeaveTimeout = useRef<number | undefined>(undefined);
  const mouseEnterTimeout = useRef<number | undefined>(undefined);

  const isOpen = useMemo(() => {
    const isControlled = typeof isOpenProp !== 'undefined';
    if (isControlled) {
      return isOpenProp;
    }

    return isOpenState;
  }, [isOpenProp, isOpenState]);

  // Closes dropdown menu
  const handleClose = useCallback(
    (e?: React.KeyboardEvent<Element> | React.MouseEvent<Element>) => {
      const isControlled = typeof isOpenProp !== 'undefined';

      if (!isControlled) {
        setIsOpenState(false);
      }

      if (typeof onClose === 'function') {
        onClose(e);
      }
    },
    [isOpenProp, onClose]
  );

  // Checks if click happens inside of dropdown menu (or its button)
  // Closes dropdownmenu if it is "outside"
  const checkClickOutside = useCallback(
    async (e: MouseEvent) => {
      if (!dropdownMenu.current || !isOpen) {
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
          scope.setLevel('warning');
          Sentry.captureException(
            new Error('DropdownMenu does not have "Actor" attached')
          );
        });
      }

      // Button that controls visibility of dropdown menu
      if (dropdownActor.current?.contains(e.target)) {
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

      handleClose();
    },
    [isOpen, onClickOutside, handleClose]
  );

  // Handled in a useEffect to avoid circular dependency from legacy class component
  useEffect(() => {
    // Clean up click handlers when the menu is closed for menus that are always rendered,
    // otherwise the click handlers get cleaned up when menu is unmounted
    if (!isOpenState && (alwaysRenderMenu || isNestedDropdown)) {
      document.removeEventListener('click', checkClickOutside, true);
    }
  }, [isOpenState, alwaysRenderMenu, isNestedDropdown, checkClickOutside]);

  // Opens dropdown menu
  const handleOpen = useCallback(
    (e?: React.MouseEvent<Element>) => {
      const isControlled = typeof isOpenProp !== 'undefined';
      if (!isControlled) {
        setIsOpenState(true);
      }

      window.clearTimeout(mouseLeaveTimeout.current);

      // If we always render menu (e.g. DropdownLink), then add the check click outside handlers when we open the menu
      // instead of when the menu component mounts. Otherwise we will have many click handlers attached on initial load.
      if (alwaysRenderMenu || isNestedDropdown) {
        document.addEventListener('click', checkClickOutside, true);
      }

      if (typeof onOpen === 'function') {
        onOpen(e);
      }
    },
    [isOpenProp, alwaysRenderMenu, isNestedDropdown, onOpen, checkClickOutside]
  );

  // Decide whether dropdown should be closed when mouse leaves element
  // Only for nested dropdowns
  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<Element>) => {
      if (!isNestedDropdown) {
        return;
      }

      const toElement = e.relatedTarget;

      try {
        if (
          dropdownMenu.current &&
          (!(toElement instanceof Element) || !dropdownMenu.current.contains(toElement))
        ) {
          window.clearTimeout(mouseLeaveTimeout.current);
          mouseLeaveTimeout.current = window.setTimeout(() => {
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
    },
    [isNestedDropdown, handleClose]
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent<Element>) => {
      if (isOpen) {
        handleClose(e);
      } else {
        handleOpen(e);
      }
    },
    [isOpen, handleClose, handleOpen]
  );

  // Control whether we should hide dropdown menu when it is clicked
  const handleDropdownMenuClick = useCallback(
    (e: React.MouseEvent<Element>) => {
      handleClose(e);
    },
    [handleClose]
  );

  // This function does nothing?
  const getRootProps = useCallback((props?: Record<string, unknown>) => {
    return props;
  }, []);

  // Actor is the component that will open the dropdown menu
  const getActorProps: GetActorPropsFn = useCallback(
    <E extends Element = Element>({style = {}, ...props}: GetActorArgs<E> = {}) => {
      // Props that the actor needs to have <DropdownMenu> work
      return mergeProps(props, {
        ref: (ref: Element | null) => {
          dropdownActor.current = ref;
        },
        style: {...style, outline: 'none'},
        'aria-expanded': isOpen,
        'aria-haspopup': 'listbox',
        onKeyDown: (e: React.KeyboardEvent<E>) => {
          if (e.key === 'Escape' && closeOnEscape) {
            handleClose(e);
          }
        },
        onMouseEnter: (e: React.MouseEvent<E>) => {
          // Only handle mouse enter for nested dropdowns
          if (!isNestedDropdown) {
            return;
          }

          window.clearTimeout(mouseEnterTimeout.current);
          window.clearTimeout(mouseLeaveTimeout.current);

          mouseEnterTimeout.current = window.setTimeout(() => {
            handleOpen(e);
          }, MENU_CLOSE_DELAY);
        },
        onMouseLeave: (e: React.MouseEvent<E>) => {
          window.clearTimeout(mouseEnterTimeout.current);
          window.clearTimeout(mouseLeaveTimeout.current);

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
        },
      });
    },
    [
      isNestedDropdown,
      closeOnEscape,
      isOpen,
      handleClose,
      handleOpen,
      handleMouseLeave,
      handleToggle,
    ]
  );

  // Menu is the menu component that <DropdownMenu> will control
  const getMenuProps: GetMenuPropsFn = useCallback(
    <E extends Element = Element>(props: GetMenuArgs<E> = {}): MenuProps<E> => {
      // Props that the menu needs to have <DropdownMenu> work
      return mergeProps(props, {
        ref: (ref: Element | null) => {
          dropdownMenu.current = ref;

          // Don't add document event listeners here if we are always rendering menu
          // Instead add when menu is opened
          if (alwaysRenderMenu || isNestedDropdown) {
            return;
          }

          if (dropdownMenu.current) {
            // 3rd arg = useCapture = so event capturing vs event bubbling
            // Use the ref to get the latest checkClickOutside function
            document.addEventListener('click', checkClickOutside, true);
          }
        },
        role: 'listbox',
        onMouseEnter: () => {
          // There is a delay before closing a menu on mouse leave, cancel this
          // action if mouse enters menu again
          window.clearTimeout(mouseLeaveTimeout.current);
        },
        onMouseLeave: handleMouseLeave,
        onClick: handleDropdownMenuClick,
      });
    },
    [
      alwaysRenderMenu,
      isNestedDropdown,
      handleMouseLeave,
      handleDropdownMenuClick,
      checkClickOutside,
    ]
  );

  // Cleanup effect (equivalent to componentWillUnmount)
  useEffect(() => {
    return () => {
      window.clearTimeout(mouseLeaveTimeout.current);
      window.clearTimeout(mouseEnterTimeout.current);
    };
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
