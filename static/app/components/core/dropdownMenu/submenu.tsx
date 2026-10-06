import {useCallback, useContext} from 'react';
import {useMenuTrigger} from '@react-aria/menu';
import type {TreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';

import {Container} from '@sentry/scraps/layout';

import {useOverlay} from 'sentry/utils/useOverlay';

import {DropdownMenuContent} from './content';
import {DropdownMenuItem, type MenuItemProps} from './item';
import {DropdownMenuContext, type DropdownMenuListProps} from './list';

interface DropdownSubmenuProps extends Pick<
  DropdownMenuListProps,
  'closeOnSelect' | 'disableTextSelection' | 'onClose' | 'size'
> {
  items: MenuItemProps[];
  node: Node<MenuItemProps>;
  state: TreeState<MenuItemProps>;
}

export function DropdownSubmenu({
  items,
  node,
  state,
  closeOnSelect,
  disableTextSelection,
  onClose,
  size,
}: DropdownSubmenuProps) {
  const {rootOverlayState} = useContext(DropdownMenuContext);
  const submenu = node.value?.submenu;
  const options = typeof submenu === 'object' ? submenu : {};
  const isDisabled = state.disabledKeys.has(node.key) || items.length === 0;
  const {
    isOpen,
    state: overlayState,
    triggerRef,
    triggerProps: {ref: setTriggerElement},
    overlayProps,
    overlayRef,
  } = useOverlay({
    isOpen: state.selectionManager.isSelected(node.key),
    onClose: rootOverlayState?.close,
    disableTrigger: isDisabled,
    position: options.position ?? 'right-start',
    offset: -4,
    preventOverflowOptions: {
      boundary: document.body,
      altAxis: true,
    },
  });
  const {menuTriggerProps, menuProps} = useMenuTrigger(
    {type: 'menu', isDisabled},
    {...overlayState, focusStrategy: 'first'},
    triggerRef
  );
  const isFocused = state.selectionManager.focusedKey === node.key;

  return (
    <Container as="li" display="contents" role="presentation">
      <DropdownMenuItem
        menuItemRef={useCallback(
          element => {
            setTriggerElement(element);
            if (element && !isOpen && isFocused && rootOverlayState?.isOpen) {
              element.focus();
            }
          },
          [isOpen, isFocused, rootOverlayState, setTriggerElement]
        )}
        id={menuTriggerProps.id}
        aria-haspopup={menuTriggerProps['aria-haspopup']}
        aria-expanded={isOpen}
        aria-controls={menuTriggerProps['aria-controls']}
        submenuRef={isOpen ? overlayRef : undefined}
        renderAs="div"
        node={node}
        state={state}
        closeOnSelect={false}
      />
      {isOpen && (
        <DropdownMenuContent
          onClose={onClose}
          closeOnSelect={closeOnSelect}
          disableTextSelection={disableTextSelection}
          menuTitle={options.title}
          size={size}
          {...menuProps}
          items={items}
          autoFocus={false}
          overlayState={overlayState}
          overlayPositionProps={overlayProps}
        />
      )}
    </Container>
  );
}
