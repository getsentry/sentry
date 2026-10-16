import {
  MenuItem,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from './declarations';
import {MenuFooter, MenuHeader} from './layout';

export const Menu = {
  Header: MenuHeader,
  Footer: MenuFooter,
  Item: MenuItem,
  Section: MenuSection,
  SectionLabel: MenuSectionLabel,
  Separator: MenuSectionSeparator,
  Submenu,
};

export type {MenuSectionProps, SubmenuProps} from './declarations';
