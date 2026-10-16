import {MenuContent, MenuFooter, MenuHeader, MenuSearch} from './content';
import {MenuCheckboxItem, MenuItem} from './item';
import {MenuList} from './list';
import {MenuRoot, MenuTrigger, type MenuProps} from './menu';
import {MenuSection, MenuSectionLabel, MenuSectionSeparator} from './section';
import {MenuSubmenu} from './submenu';

export function Menu(props: MenuProps) {
  return <MenuRoot {...props} />;
}
Menu.Root = MenuRoot;
Menu.Trigger = MenuTrigger;
Menu.Content = MenuContent;
Menu.Header = MenuHeader;
Menu.Search = MenuSearch;
Menu.List = MenuList;
Menu.Section = MenuSection;
Menu.SectionLabel = MenuSectionLabel;
Menu.ListItem = MenuItem;
Menu.CheckboxItem = MenuCheckboxItem;
Menu.SectionSeparator = MenuSectionSeparator;
Menu.Footer = MenuFooter;
Menu.Submenu = MenuSubmenu;

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
