import {
  darkTheme as packageDarkTheme,
  lightTheme as packageLightTheme,
} from '@sentry/scraps/theme';

import {darkTheme, lightTheme} from './theme';

it.each([
  [lightTheme, packageLightTheme],
  [darkTheme, packageDarkTheme],
])(
  'disables app test transitions without changing theme values',
  (appTheme, packageTheme) => {
    expect(appTheme).toEqual({...packageTheme, motion: appTheme.motion});
    expect(appTheme.motion.smooth).toEqual(packageTheme.motion.smooth);
    expect(appTheme.motion.framer.smooth.fast).toEqual({
      duration: 0,
      staggerChildren: 0,
      type: false,
    });
  }
);
