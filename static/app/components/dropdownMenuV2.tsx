import {Fragment, ReactNode, RefObject, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';
import {useKeyboard} from '@react-aria/interactions';
import {AriaMenuOptions, useMenu} from '@react-aria/menu';
import {
  AriaPositionProps,
  OverlayProps,
  useOverlay,
  useOverlayPosition,
} from '@react-aria/overlays';
import {useSeparator} from '@react-aria/separator';
import {mergeProps} from '@react-aria/utils';
import {useTreeState} from '@react-stately/tree';
import {Node} from '@react-types/shared';

import MenuControl from 'sentry/components/dropdownMenuControlV2';
import MenuItem, {MenuItemProps} from 'sentry/components/dropdownMenuItemV2';
import MenuSection from 'sentry/components/dropdownMenuSectionV2';
import space from 'sentry/styles/space';

type Props = {
  onClose?: () => void;
  /**
   * Whether the menu should close when an item has been clicked/selected
   */
  closeOnSelect?: boolean;
  /**
   * Ref object to the trigger element, needed for useOverlayPosition()
   */
  triggerRef: RefObject<HTMLButtonElement>;
  /**
   * Whether this is a submenu
   */
  isSubmenu: boolean;
  /**
   * If this is a submenu, it will in some cases need to close the root menu
   * (e.g. when a submenu item is clicked).
   */
  closeRootMenu: () => void;
  /**
   * If this is a submenu, it will in some cases need to close itself
   * (e.g. when the user presses the arrow left key)
   */
  closeCurrentSubmenu?: () => void;
} & AriaMenuOptions<MenuItemProps> &
  Partial<OverlayProps> &
  Partial<AriaPositionProps>;

function Menu({
  offset = 8,
  crossOffset = 0,
  placement = 'bottom left',
  closeOnSelect = true,
  triggerRef,
  isSubmenu,
  closeRootMenu,
  closeCurrentSubmenu,
  isDismissable = true,
  shouldCloseOnBlur = true,
  ...props
}: Props) {
  const state = useTreeState<MenuItemProps>({...props, selectionMode: 'single'});
  const stateCollection = [...state.collection];

  /**
   * Implement focus states, keyboard navigation, aria-label,...
   */
  const menuRef = useRef(null);
  const {menuProps} = useMenu({...props, selectionMode: 'single'}, state, menuRef);

  /**
   * If this is a submenu, pressing arrow left should close it
   * (but not the root menu).
   */
  const {keyboardProps} = useKeyboard({
    onKeyDown: e => {
      if (isSubmenu && e.key === 'ArrowLeft') {
        closeCurrentSubmenu?.();
      } else {
        e.continuePropagation();
      }
    },
  });

  /**
   * Close the menu on outside interaction, blur, or Esc key press,
   * and control its position relative to the trigger button.
   * See:
   *   https://react-spectrum.adobe.com/react-aria/useOverlay.html
   *   https://react-spectrum.adobe.com/react-aria/useOverlayPosition.html
   */
  const overlayRef = useRef(null);
  const {overlayProps} = useOverlay(
    {
      onClose: closeRootMenu,
      shouldCloseOnBlur,
      isDismissable,
      isOpen: true,
    },
    overlayRef
  );
  const {overlayProps: positionProps} = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    offset,
    crossOffset,
    placement,
    isOpen: true,
    containerPadding: 0,
  });

  /**
   * Store whether this menu/submenu is the current focused one, which
   * in a nested, tree-like menu system should be the leaf submenu.
   * This information is used for controlling keyboard events.
   * See: modifiedMenuProps below.
   */
  const [hasFocus, setHasFocus] = useState(true);
  useEffect(() => {
    /**
     * A submenu is a leaf when it does not contain any expanded submenu.
     * This logically follows from the tree-like structure and single-selection
     * nature of menus.
     */
    const isLeafSubmenu = !stateCollection.some(node => {
      const isSection = node.hasChildNodes && !node.value.isSubmenu;
      /**
       * A submenu with key [key] is expanded if
       * state.selectionManager.isSelected([key]) = true
       */
      return isSection
        ? [...node.childNodes].some(child =>
            state.selectionManager.isSelected(`${child.key}`)
          )
        : state.selectionManager.isSelected(`${node.key}`);
    });
    setHasFocus(isLeafSubmenu);
  }, [state.selectionManager.selectedKeys]);
  /**
   * Menu props from useMenu, modified to disable keyboard events
   * if the current menu does not have focus.
   */
  const modifiedMenuProps = {
    ...menuProps,
    ...(!hasFocus && {
      onKeyUp: () => null,
      onKeyDown: () => null,
    }),
  };

  /**
   * Render a single menu item
   */
  const renderItem = (node: Node<MenuItemProps>, isLastNode: boolean) => {
    return (
      <MenuItem
        node={node}
        isLastNode={isLastNode}
        state={state}
        onClose={closeRootMenu}
        closeOnSelect={closeOnSelect}
      />
    );
  };

  /**
   * Render a submenu whose trigger button is a menu item
   */
  const renderItemWithSubmenu = (node: Node<MenuItemProps>, isLastNode: boolean) => {
    const trigger = ({props: submenuTriggerProps, ref: submenuTriggerRef}) => (
      <MenuItem
        ref={submenuTriggerRef}
        renderAs="div"
        node={node}
        isLastNode={isLastNode}
        state={state}
        isSubmenuTrigger
        {...submenuTriggerProps}
      />
    );

    return (
      <MenuControl
        items={node.value.children as MenuItemProps[]}
        trigger={trigger}
        placement="right"
        offset={-4}
        crossOffset={4}
        closeOnSelect={closeOnSelect}
        isOpen={state.selectionManager.isSelected(node.key)}
        isSubmenu
        closeRootMenu={closeRootMenu}
        closeCurrentSubmenu={() => state.selectionManager.clearSelection()}
        renderWrapAs="li"
      />
    );
  };

  /**
   * Render a collection of menu items
   */
  const renderCollection = (collection: Node<MenuItemProps>[]) =>
    collection.map((node, i) => {
      const isLastNode = collection.length - 1 === i;
      const showSeparator =
        !isLastNode && (node.type === 'section' || collection[i + 1]?.type === 'section');
      const {separatorProps} = useSeparator({elementType: 'li'});

      let itemToRender: ReactNode;

      if (node.type === 'section') {
        itemToRender = (
          <MenuSection node={node}>{renderCollection([...node.childNodes])}</MenuSection>
        );
      } else {
        itemToRender = node.value.isSubmenu
          ? renderItemWithSubmenu(node, isLastNode)
          : renderItem(node, isLastNode);
      }

      return (
        <Fragment key={node.key}>
          {itemToRender}
          {showSeparator && <Separator {...separatorProps} />}
        </Fragment>
      );
    });

  return (
    <FocusScope restoreFocus autoFocus>
      <Overlay
        ref={overlayRef}
        {...mergeProps(overlayProps, positionProps, keyboardProps)}
      >
        <MenuWrap ref={menuRef} {...modifiedMenuProps}>
          {renderCollection(stateCollection)}
        </MenuWrap>
      </Overlay>
    </FocusScope>
  );
}

export default Menu;

const Overlay = styled('div')`
  display: block;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundElevated};
  box-shadow: 0 0 0 1px ${p => p.theme.translucentBorder}, ${p => p.theme.dropShadowHeavy};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const MenuWrap = styled('ul')`
  margin: 0;
  padding: ${space(0.5)} 0;
  font-size: ${p => p.theme.fontSizeMedium};

  &:focus {
    outline: none;
  }
`;

const Separator = styled('li')`
  list-style-type: none;
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};
`;
