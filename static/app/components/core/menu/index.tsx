import {
  MenuItem,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from './declarations';
import {MenuFooter} from './footer';
import {MenuHeader} from './header';

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
