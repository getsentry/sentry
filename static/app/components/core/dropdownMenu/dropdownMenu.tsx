import {useContext, useMemo} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {useButton} from '@react-aria/button';
import {useMenuTrigger} from '@react-aria/menu';

import {ControlContext} from '@sentry/scraps/compactSelect/control';

import type {UseOverlayProps} from 'sentry/utils/useOverlay';
import {useOverlay} from 'sentry/utils/useOverlay';

import {DropdownMenuContent} from './content';
import {DropdownButton} from './dropdownButton';
import type {MenuItemProps} from './item';
import type {DropdownMenuListProps} from './list';
import {DropdownMenuContext} from './list';

export type {MenuItemProps};

export interface DropdownMenuProps
  extends
    Omit<
      DropdownMenuListProps,
      'overlayState' | 'overlayPositionProps' | 'items' | 'children' | 'menuTitle'
    >,
    Pick<
      UseOverlayProps,
      | 'isOpen'
      | 'offset'
      | 'position'
      | 'isDismissable'
      | 'shouldCloseOnBlur'
      | 'shouldCloseOnInteractOutside'
      | 'onInteractOutside'
      | 'onOpenChange'
      | 'preventOverflowOptions'
      | 'flipOptions'
      | 'shouldApplyMinWidth'
      | 'strategy'
    > {
  /**
   * Items to display inside the dropdown menu. If the item has a `children`
   * prop, it will be rendered as a menu section. If it has a `children` prop
   * and its `submenu` prop is set, it will be rendered as a submenu.
   */
  items: MenuItemProps[];
  /**
   * Pass class name to the outer wrap
   */
  className?: string;
  /**
   * Whether the trigger is disabled.
   */
  isDisabled?: boolean;
  /**
   * Maximum menu width
   */
  maxMenuHeight?: number;
  /**
   * Title for the current menu.
   */
  menuTitle?: React.ReactNode;
  /**
   * Minimum menu width
   */
  minMenuWidth?: number;
  /**
   * Reference to the container element that the portal should be rendered into.
   */
  portalContainerRef?: React.RefObject<HTMLElement | null>;
  /**
   * Tag name for the outer wrap, defaults to `div`
   */
  renderWrapAs?: React.ElementType;
  /**
   * Affects the size of the trigger button and menu items.
   */
  size?: DropdownMenuListProps['size'];
  /**
   * Optionally replace the trigger button with a different component. Note
   * that the replacement must have the `props` and `ref` (supplied in
   * TriggerProps) forwarded its outer wrap, otherwise the accessibility
   * features won't work correctly.
   */
  trigger?: (
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
  ) => React.ReactNode;
  /**
   * By default, the menu trigger will be rendered as a button, with
   * triggerLabel as the button label.
   */
  triggerLabel?: React.ReactNode;
  /**
   * Whether to render the menu inside a React portal (false by default). This should
   * only be enabled if necessary, e.g. when the dropdown menu is inside a small,
   * scrollable container that messes with the menu's position. Some features, namely
   * submenus, will not work correctly inside portals.
   *
   * Consider passing `strategy` as `'fixed'` before using `usePortal`
   */
  usePortal?: boolean;
}

/**
 * A menu component that renders both the trigger button and the dropdown
 * menu. See: https://react-spectrum.adobe.com/react-aria/useMenuTrigger.html
 */
function DropdownMenu({
  items,
  disabledKeys,
  trigger,
  triggerLabel,
  isDisabled: disabledProp,
  isOpen: isOpenProp,
  renderWrapAs = 'div',
  size = 'md',
  className,

  // Overlay props
  usePortal = false,
  offset = 8,
  position = 'bottom-start',
  isDismissable = true,
  shouldCloseOnBlur = true,
  shouldCloseOnInteractOutside,
  onInteractOutside,
  onOpenChange,
  preventOverflowOptions,
  flipOptions,
  portalContainerRef,
  shouldApplyMinWidth,
  maxMenuHeight,
  minMenuWidth,
  // This prop is from popperJS and is an alternative to portals. Use this with components like modals where portalling to document body doesn't work well.
  strategy,
  ...props
}: DropdownMenuProps) {
  const isDisabled = disabledProp ?? (!items || items.length === 0);

  const {rootOverlayState} = useContext(DropdownMenuContext);
  const {
    isOpen,
    state: overlayState,
    triggerRef,
    triggerProps: overlayTriggerProps,
    overlayProps,
  } = useOverlay({
    isOpen: isOpenProp,
    onClose: rootOverlayState?.close,
    offset,
    position,
    isDismissable,
    disableTrigger: isDisabled,
    shouldCloseOnBlur,
    shouldCloseOnInteractOutside,
    onInteractOutside,
    preventOverflowOptions,
    flipOptions,
    onOpenChange,
    shouldApplyMinWidth,
    strategy,
  });

  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...overlayState, focusStrategy: 'first'},
    triggerRef
  );
  // We manually handle focus in the dropdown menu, so we don't want the default autofocus behavior
  // Avoids the menu from focusing before popper has placed it in the correct position
  const resolvedMenuProps = {...menuProps, autoFocus: false as const};

  const {buttonProps} = useButton(
    {
      isDisabled,
      ...menuTriggerProps,
    },
    triggerRef
  );

  function renderMenu() {
    if (!isOpen) {
      return null;
    }

    const menu = (
      <DropdownMenuContent
        {...props}
        {...resolvedMenuProps}
        size={size}
        disabledKeys={disabledKeys}
        overlayPositionProps={{
          ...overlayProps,
          style: {
            ...overlayProps.style,
            minWidth: minMenuWidth ?? overlayProps.style?.minWidth,
            maxHeight: maxMenuHeight ?? overlayProps.style?.maxHeight,
          },
        }}
        overlayState={overlayState}
        items={items}
      />
    );

    return usePortal
      ? createPortal(menu, portalContainerRef?.current ?? document.body)
      : menu;
  }

  const controlContextValue = useMemo(
    () => ({
      overlayIsOpen: isOpen,
      disabled: isDisabled,
      size,
      search: '',
      searchable: false,
    }),
    [isOpen, size, isDisabled]
  );

  return (
    <DropdownMenuWrap className={className} as={renderWrapAs} role="presentation">
      <ControlContext value={controlContextValue}>
        {trigger ? (
          trigger({...buttonProps, ...overlayTriggerProps}, isOpen)
        ) : (
          <DropdownButton
            size={size}
            isOpen={isOpen}
            {...buttonProps}
            {...overlayTriggerProps}
          >
            {triggerLabel}
          </DropdownButton>
        )}
        {/* oxlint-disable-next-line react/refs */}
        {renderMenu()}
      </ControlContext>
    </DropdownMenuWrap>
  );
}

export {DropdownMenu};

const DropdownMenuWrap = styled('div')`
  display: contents;
  list-style-type: none;
`;
