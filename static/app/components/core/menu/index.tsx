import {MenuListItem} from '@sentry/scraps/menuListItem';

import {
  MenuFooterLayout,
  MenuHeaderLayout,
  MenuHeading,
  MenuSectionDivider,
  MenuSectionGroup,
  MenuSectionHeading,
  MenuSectionLayout,
} from './layout';
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
  Item: MenuListItem,
};
