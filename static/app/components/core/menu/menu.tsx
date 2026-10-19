import {useRef, useState} from 'react';
import {mergeProps} from '@react-aria/utils';

import {
  DropdownButton,
  type DropdownButtonProps,
} from '@sentry/scraps/dropdownMenu/dropdownButton';

import type {UseOverlayProps} from 'sentry/utils/useOverlay';
import {useOverlay} from 'sentry/utils/useOverlay';

import {MenuContext, useMenuContext} from './context';

export interface MenuProps extends Pick<
  UseOverlayProps,
  'isOpen' | 'defaultOpen' | 'onOpenChange' | 'position' | 'offset'
> {
  children: React.ReactNode;
}

/** Owns the menu overlay, search state, and context for compound menu parts. */
export function MenuRoot({
  children,
  isOpen,
  defaultOpen,
  onOpenChange,
  position = 'bottom-start',
  offset = 8,
}: MenuProps) {
  const overlay = useOverlay({
    isOpen,
    defaultOpen,
    onOpenChange,
    position,
    offset,
    type: 'menu',
    shouldCloseOnBlur: true,
    shouldApplyMinWidth: false,
  });
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');

  return (
    <MenuContext
      value={{
        isOpen: overlay.isOpen,
        overlayProps: overlay.overlayProps,
        triggerProps: overlay.triggerProps,
        close: overlay.state.close,
        listRef,
        open: overlay.state.open,
        searchRef,
        search,
        setSearch,
      }}
    >
      {children}
    </MenuContext>
  );
}

export type MenuTriggerProps = Omit<DropdownButtonProps, 'isOpen'> & {
  children: React.ReactNode;
};

/** Opens the menu and forwards trigger behavior to the dropdown button. */
export function MenuTrigger(props: MenuTriggerProps) {
  const {isOpen, open, triggerProps} = useMenuContext();
  const mergedProps = mergeProps(triggerProps, props);
  return (
    <DropdownButton
      {...mergedProps}
      isOpen={isOpen}
      onKeyDown={event => {
        mergedProps.onKeyDown?.(event);
        if (!event.defaultPrevented && event.key === 'ArrowDown') {
          event.preventDefault();
          open();
        }
      }}
    >
      {props.children}
    </DropdownButton>
  );
}
