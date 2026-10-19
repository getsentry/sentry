import {MenuContent, MenuFooter, MenuHeader, MenuSearch} from './content';
import {MenuCheckboxItem, MenuItem} from './item';
import {MenuList} from './list';
import {MenuRoot, MenuTrigger} from './menu';
import {MenuSection, MenuSectionLabel, MenuSectionSeparator} from './section';
import {MenuSubmenu} from './submenu';

export const Menu = Object.assign(MenuRoot, {
  Root: MenuRoot,
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

export type {MenuProps, MenuTriggerProps} from './menu';
export type {
  MenuContentProps,
  MenuFooterProps,
  MenuHeaderProps,
  MenuSearchProps,
} from './content';
export type {MenuCheckboxItemProps, MenuListItemProps} from './item';
export type {MenuListProps} from './list';
export type {MenuSectionLabelProps, MenuSectionProps} from './section';
export type {MenuSubmenuProps} from './submenu';
