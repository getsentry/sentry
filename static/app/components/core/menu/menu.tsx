import {useRef, useState} from 'react';
import {mergeProps} from '@react-aria/utils';

import {
  DropdownButton,
  type DropdownButtonProps,
} from '@sentry/scraps/dropdownMenu/dropdownButton';

import type {UseOverlayProps} from 'sentry/utils/useOverlay';
import {useOverlay} from 'sentry/utils/useOverlay';

import {MenuContent, MenuFooter, MenuHeader, MenuSearch} from './content';
import {MenuContext, useMenuContext} from './context';
import {MenuCheckboxItem, MenuItem} from './item';
import {MenuList} from './list';
import {MenuSection, MenuSectionLabel, MenuSectionSeparator} from './section';
import {MenuSubmenu} from './submenu';

export interface MenuProps extends Pick<
  UseOverlayProps,
  'isOpen' | 'defaultOpen' | 'onOpenChange' | 'position' | 'offset'
> {
  children: React.ReactNode;
}

function MenuRoot({
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

function MenuTrigger(props: MenuTriggerProps) {
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

export const Menu = Object.assign(MenuRoot, {
  Trigger: MenuTrigger,
  Content: MenuContent,
  Header: MenuHeader,
  Search: MenuSearch,
  List: MenuList,
  Section: MenuSection,
  SectionLabel: MenuSectionLabel,
  ListItem: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  SectionSeparator: MenuSectionSeparator,
  Footer: MenuFooter,
  Submenu: MenuSubmenu,
});
