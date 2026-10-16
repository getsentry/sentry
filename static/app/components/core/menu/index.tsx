import {
  ListItem,
  MenuItem,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from './declarations';
import {MenuFooter, MenuHeader} from './layout';
import {MenuSearchField} from './searchField';

export const Menu = {
  Header: MenuHeader,
  Footer: MenuFooter,
  SearchField: MenuSearchField,
  Item: MenuItem,
  ListItem,
  Section: MenuSection,
  SectionLabel: MenuSectionLabel,
  Separator: MenuSectionSeparator,
  Submenu,
};

export type {MenuSearchFieldProps} from './searchField';
export type {MenuSectionProps, SubmenuProps} from './declarations';
