import {useCallback, useContext} from 'react';
import {useTheme} from '@emotion/react';
import {FocusScope} from '@react-aria/focus';
import {useMenuTrigger} from '@react-aria/menu';
import type {TreeState} from '@react-stately/tree';
import type {Node} from '@react-types/shared';

import {Container} from '@sentry/scraps/layout';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
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
  const theme = useTheme();
  const {rootOverlayState} = useContext(DropdownMenuContext);
  const submenu = node.value?.submenu;
  const options = typeof submenu === 'object' ? submenu : {};
  const isDisabled =
    state.disabledKeys.has(node.key) || (items.length === 0 && !options.content);
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
        aria-haspopup={options.content ? 'dialog' : menuTriggerProps['aria-haspopup']}
        aria-expanded={isOpen}
        aria-controls={menuTriggerProps['aria-controls']}
        submenuRef={isOpen ? overlayRef : undefined}
        renderAs="div"
        node={node}
        state={state}
        closeOnSelect={false}
      />
      {isOpen && options.content ? (
        <FocusScope restoreFocus autoFocus>
          <PositionWrapper {...overlayProps} zIndex={theme.zIndex.dropdown}>
            <Overlay
              id={menuProps.id}
              role="dialog"
              aria-label={options.title}
              aria-labelledby={options.title ? undefined : menuTriggerProps.id}
              onKeyDown={event => {
                if (event.defaultPrevented) {
                  return;
                }
                const isEditingText =
                  event.target instanceof HTMLElement &&
                  event.target.matches('input, textarea, [contenteditable="true"]');
                if (
                  event.key === 'Escape' ||
                  (event.key === 'ArrowLeft' && !isEditingText)
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  state.selectionManager.clearSelection();
                }
              }}
            >
              {options.content({close: () => rootOverlayState?.close()})}
            </Overlay>
          </PositionWrapper>
        </FocusScope>
      ) : isOpen ? (
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
      ) : null}
    </Container>
  );
}
