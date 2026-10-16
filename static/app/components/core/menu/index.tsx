import {
  MenuItem,
  MenuSection,
  MenuSectionLabel,
  MenuSectionSeparator,
  Submenu,
} from './declarations';
import {MenuFooter, MenuHeader} from './layout';
import {MenuRoot} from './root';

export const Menu = {
  Root: MenuRoot,
  Header: MenuHeader,
  Footer: MenuFooter,
  Item: MenuItem,
  Section: MenuSection,
  SectionLabel: MenuSectionLabel,
  Separator: MenuSectionSeparator,
  Submenu,
};

export type {MenuSectionProps, SubmenuProps} from './declarations';
