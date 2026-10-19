import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuSectionDivider,
  MenuSectionGroup,
  MenuSectionHeading,
  MenuSectionLayout,
} from './layout';
import {MenuItem} from './listItem';
import {SearchInput} from './searchInput';

/** Shared presentation; consumers own state, keyboard behavior, and ARIA roles. */
export const Menu = {
  Header: MenuHeaderLayout,
  Title: MenuHeading,
  Search: SearchInput,
  Section: MenuSectionLayout,
  SectionTitle: MenuSectionHeading,
  SectionItems: MenuSectionGroup,
  Separator: MenuSectionDivider,
  Footer: MenuFooterLayout,
  Item: MenuItem,
};

export type {MenuListItemProps} from './listItem';
