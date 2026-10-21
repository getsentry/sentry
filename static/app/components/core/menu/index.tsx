/** Shared presentation; consumers own state, keyboard behavior, and ARIA roles. */
export {
  MenuFooterLayout as Footer,
  MenuHeaderLayout as Header,
  MenuHeading as Title,
  MenuSectionLabel as SectionLabel,
  MenuSectionHeader as SectionHeader,
  MenuSectionGroup as SectionGroup,
  MenuSectionList as SectionList,
  MenuListItem as ListItem,
  MenuSectionSeparator as SectionSeparator,
  SearchInput as Search,
} from './menu';

export type {ListItemProps} from './menu';

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

/** Shared presentation for menu controls. */
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
