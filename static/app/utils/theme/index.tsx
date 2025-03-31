export type {
  Aliases,
  Color,
  ColorMapping,
  ColorOrAlias,
  FormSize,
  FormTheme,
  IconSize,
  StrictCSSObject,
  Theme,
} from './theme';

import {darkTheme, lightTheme} from './theme';

export {lightTheme, darkTheme};
// @deprecated use useTheme hook instead of directly importing the theme. If you require a theme for your tests, use ThemeFixture.
export default lightTheme;
