import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuItemGroupLabel,
  MenuSectionGroup,
  MenuSectionGroupList,
  MenuListItem,
  MenuSectionDivider,
  SearchInput,
} from './menu';

/** Shared presentation; consumers own state, keyboard behavior, and ARIA roles. */
export const Menu = {
  Header: MenuHeaderLayout,
  Title: MenuHeading,
  Search: SearchInput,
  SectionGroup: MenuSectionGroup,
  ItemGroupLabel: MenuItemGroupLabel,
  SectionGroupList: MenuSectionGroupList,
  Separator: MenuSectionDivider,
  Footer: MenuFooterLayout,
  ListItem: MenuListItem,
};

export type {ListItemProps} from './menu';
