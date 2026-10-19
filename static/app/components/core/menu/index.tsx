import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuItemGroupLabel,
  MenuSectionGroup,
  MenuSectionList,
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
  SectionList: MenuSectionList,
  Separator: MenuSectionDivider,
  Footer: MenuFooterLayout,
  ListItem: MenuListItem,
};

export type {ListItemProps} from './menu';
