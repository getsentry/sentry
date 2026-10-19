import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuItemGroupLabel,
  MenuItemGroupLayout,
  MenuItemGroupList,
  MenuListItem,
  MenuSectionDivider,
  SearchInput,
} from './menu';

/** Shared presentation; consumers own state, keyboard behavior, and ARIA roles. */
export const Menu = {
  Header: MenuHeaderLayout,
  Title: MenuHeading,
  Search: SearchInput,
  ItemGroup: MenuItemGroupLayout,
  ItemGroupLabel: MenuItemGroupLabel,
  ItemGroupList: MenuItemGroupList,
  Separator: MenuSectionDivider,
  Footer: MenuFooterLayout,
  ListItem: MenuListItem,
};

export type {ListItemProps} from './menu';
