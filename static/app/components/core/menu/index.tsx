import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuSectionLabel,
  MenuSectionGroup,
  MenuSectionList,
  MenuListItem,
  MenuSectionSeparator,
  SearchInput,
} from './menu';

/** Shared presentation; consumers own state, keyboard behavior, and ARIA roles. */
export const Menu = {
  Header: MenuHeaderLayout,
  Title: MenuHeading,
  Search: SearchInput,
  SectionGroup: MenuSectionGroup,
  SectionLabel: MenuSectionLabel,
  SectionList: MenuSectionList,
  SectionSeparator: MenuSectionSeparator,
  Footer: MenuFooterLayout,
  ListItem: MenuListItem,
};

export type {ListItemProps} from './menu';
