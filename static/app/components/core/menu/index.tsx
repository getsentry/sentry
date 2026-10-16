import {
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
  Section: MenuSection,
  SectionLabel: MenuSectionLabel,
  Separator: MenuSectionSeparator,
  Submenu,
};

export {MenuHeader, MenuFooter} from './layout';
export {MenuSearchField, type MenuSearchFieldProps} from './searchField';
export {
  MenuItem,
  ListItem,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from './declarations';
export type {MenuSectionProps, SubmenuProps} from './declarations';
