import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuSectionLabel,
  MenuSectionHeader,
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
  SectionHeader: MenuSectionHeader,
  SectionList: MenuSectionList,
  SectionSeparator: MenuSectionSeparator,
  Footer: MenuFooterLayout,
  ListItem: MenuListItem,
};

export type {ListItemProps} from './menu';
